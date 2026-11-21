"use client";

// Public, shareable Wrapped: /wrapped/<userId>?year=2026
// Anyone with the link sees that reader's year in review. No profile needs
// to be picked, and it works in any month and for past years.

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Wrapped from "@/components/Wrapped";
import { getUser } from "@/lib/books";
import { isFirebaseConfigured } from "@/lib/firebase";

export default function SharedWrappedPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#191932]" />}>
      <SharedWrapped />
    </Suspense>
  );
}

function SharedWrapped() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = params?.userId ?? "";
  const asked = parseInt(useSearchParams().get("year") ?? "", 10);
  const year = asked >= 2000 && asked <= 2100 ? asked : new Date().getFullYear();
  const [name, setName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // A failed lookup (database unreachable or refusing reads) is not the same
  // as a bad link, and shouldn't be reported as one.
  const [loadError, setLoadError] = useState<string | null>(null);
  const usable = Boolean(userId) && isFirebaseConfigured;
  const missing = !usable || notFound;

  useEffect(() => {
    if (!usable) return;
    let cancelled = false;
    getUser(userId)
      .then((u) => {
        if (cancelled) return;
        if (u) setName(u.name);
        else setNotFound(true);
      })
      .catch((err) => {
        console.error("[wrapped] Failed to load reader:", err);
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, usable]);

  return (
    <main className="min-h-screen bg-[#191932] flex items-center justify-center p-6 text-center">
      {loadError ? (
        <div>
          <p className="text-5xl mb-3">🔌</p>
          <p className="text-white mb-1">Couldn&apos;t reach the book database just now.</p>
          <p className="text-white/50 text-sm mb-4">{loadError}</p>
          <button onClick={() => window.location.reload()} className="text-amber-300 underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : missing ? (
        <div>
          <p className="text-5xl mb-3">📖</p>
          <p className="text-white mb-4">This Wrapped link doesn&apos;t point to a reader.</p>
          <button onClick={() => router.push("/")} className="text-amber-300 underline underline-offset-2">
            Go to BookShelf
          </button>
        </div>
      ) : name ? (
        <Wrapped userId={userId} userName={name} year={year} onClose={() => router.push("/")} />
      ) : (
        <p className="text-white/70">Wrapping up the year…</p>
      )}
    </main>
  );
}
