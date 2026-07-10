"use client";

import { useEffect, useState } from "react";
import RatingForm from "@/components/RatingForm";
import BookList from "@/components/BookList";
import UserPicker from "@/components/UserPicker";
import UserMenu from "@/components/UserMenu";
import { useLocalStorage } from "@/components/useLocalStorage";
import { AppUser, BookFields, addBook, getUser } from "@/lib/books";
import { isFirebaseConfigured } from "@/lib/firebase";

const BG_COLOR_KEY = "bookRatings.bgColor";
const USER_ID_KEY = "bookapp_userId";

function isLightColor(hex: string): boolean {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export default function Home() {
  const [view, setView] = useState<"entry" | "list">("entry");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editMode, setEditMode] = useState(false);

  const [storedBg, applyBgColor] = useLocalStorage(BG_COLOR_KEY);
  const bgColor =
    storedBg && /^#[0-9a-f]{6}$/i.test(storedBg) ? storedBg : null;

  // Current user: id persisted in localStorage, name loaded from Firestore
  const [storedUserId, setStoredUserId] = useLocalStorage(USER_ID_KEY);
  const [user, setUser] = useState<AppUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUserLoading(false);
      return;
    }
    let cancelled = false;
    if (!storedUserId) {
      setUser(null);
      setUserLoading(false);
      return;
    }
    setUserLoading(true);
    getUser(storedUserId)
      .then((u) => {
        if (cancelled) return;
        setUser(u); // null if the stored id no longer exists → picker shows
        setUserLoading(false);
      })
      .catch((err) => {
        console.error("[users] Failed to load current user:", err);
        if (!cancelled) {
          setUser(null);
          setUserLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storedUserId]);

  function selectUser(next: AppUser) {
    setStoredUserId(next.id);
    setUser(next);
    setPickerOpen(false);
  }

  async function handleSubmit(values: BookFields) {
    if (!user) {
      setPickerOpen(true);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await addBook(user.id, values);
      setSubmitted(true);
    } catch (err) {
      console.error("[books] Failed to save book:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setError(null);
    setFormKey((k) => k + 1);
  }

  function switchView(next: "entry" | "list") {
    setView(next);
    setSubmitted(false);
    setError(null);
  }

  const light = bgColor !== null && isLightColor(bgColor);
  const showPicker =
    isFirebaseConfigured && !userLoading && (pickerOpen || user === null);

  return (
    <main
      className={`min-h-screen ${bgColor ? "" : "bg-textured"}`}
      style={bgColor ? { background: bgColor } : undefined}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-sm border-b py-4 ${
          light ? "bg-white/20 border-black/10" : "bg-black/20 border-white/10"
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-4">
          {user && (
            <UserMenu
              name={user.name}
              light={light}
              view={view}
              editMode={editMode}
              bgColor={bgColor}
              onToggleEditMode={() => setEditMode((e) => !e)}
              onApplyBgColor={applyBgColor}
              onSwitchView={switchView}
              onChangeUser={() => setPickerOpen(true)}
            />
          )}
          <h1
            className={`text-xl font-bold ${light ? "text-gray-900" : "text-white"}`}
          >
            Book
            <span className={light ? "text-indigo-700 ml-2" : "text-indigo-300 ml-2"}>
              Ratings
            </span>
          </h1>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {!isFirebaseConfigured && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            Firestore isn&apos;t configured, so profiles and saving are
            disabled. Copy <code>.env.local.example</code> to{" "}
            <code>.env.local</code> and fill in your Firebase project&apos;s
            values.
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {view === "list" && user ? (
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
            <BookList userId={user.id} />
          </div>
        ) : submitted ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center gap-4">
            <span className="text-4xl">✅</span>
            <h2 className="text-lg font-semibold text-gray-800">
              Thanks — your rating has been recorded!
            </h2>
            <button
              onClick={handleReset}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              Submit another rating
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
            <RatingForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} editMode={editMode} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        className={`mt-16 py-8 text-center border-t ${
          light ? "border-black/10" : "border-white/10"
        }`}
      >
        <p className={`text-xs ${light ? "text-gray-500/70" : "text-white/20"}`}>
          Every rating helps someone find their next great read.
        </p>
      </footer>

      {showPicker && (
        <UserPicker
          onSelect={selectUser}
          onCancel={user ? () => setPickerOpen(false) : undefined}
        />
      )}
    </main>
  );
}
