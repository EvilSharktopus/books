"use client";

import { useEffect, useState } from "react";
import { AppUser, BookDoc, findBookByTitle, listUsers } from "@/lib/books";
import { sendRecommendations, listSentForBook } from "@/lib/recommendations";

interface RecipientRow {
  user: AppUser;
  alreadyRating: number | null; // their rating if they have the book
  alreadyRecommended: boolean; // current user already sent them this book
}

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
      {initial}
    </span>
  );
}

export default function RecommendModal({
  book,
  fromUser,
  onClose,
  onSent,
}: {
  book: BookDoc;
  fromUser: AppUser;
  onClose: () => void;
  onSent: () => void;
}) {
  const [rows, setRows] = useState<RecipientRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Critical path: the user list. If this fails, there's nothing to show.
      let others: AppUser[];
      try {
        const users = await listUsers();
        others = users.filter((u) => u.id !== fromUser.id);
      } catch (err) {
        console.error("[recs] Failed to load users:", err);
        if (!cancelled) setRows([]);
        return;
      }

      // Best-effort enrichment — a failure here must not hide recipients.
      const sentTo = new Set<string>();
      try {
        for (const r of await listSentForBook(fromUser.id, book.id)) sentTo.add(r.toUserId);
      } catch (err) {
        console.error("[recs] Failed to load prior recommendations:", err);
      }

      const built = await Promise.all(
        others.map(async (user) => {
          let alreadyRating: number | null = null;
          try {
            const theirs = await findBookByTitle(user.id, book.title);
            if (theirs && theirs.myRating > 0) alreadyRating = theirs.myRating;
          } catch (err) {
            console.error(`[recs] book check failed for ${user.name}:`, err);
          }
          return { user, alreadyRating, alreadyRecommended: sentTo.has(user.id) } as RecipientRow;
        })
      );
      if (!cancelled) setRows(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [book.id, book.title, fromUser.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (sending || selected.size === 0) return;
    setSending(true);
    try {
      await sendRecommendations(book, fromUser, [...selected], note);
      setSent(true);
      onSent();
      setTimeout(onClose, 900);
    } catch (err) {
      console.error("[recs] Failed to send:", err);
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-gray-800">Recommend this book</p>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <p className="text-sm text-gray-500 mb-4 truncate">
          {book.title} · {book.authors}
        </p>

        {rows === null ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading friends…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No other readers to recommend to yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1 mb-4">
              {rows.map(({ user, alreadyRating, alreadyRecommended }) => (
                <label
                  key={user.id}
                  className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                    alreadyRating != null ? "opacity-70" : "hover:bg-blue-50 cursor-pointer"
                  }`}
                >
                  <Avatar name={user.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-800 truncate">{user.name}</span>
                    {alreadyRating != null ? (
                      <span className="block text-xs text-gray-400">Already read it — {alreadyRating}/10</span>
                    ) : alreadyRecommended ? (
                      <span className="block text-xs text-amber-600">Already recommended · send again?</span>
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() => toggle(user.id)}
                    className="w-4 h-4"
                  />
                </label>
              ))}
            </div>

            <div className="mb-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 140))}
                placeholder="Why they'll like it (optional)…"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <p className="text-[11px] text-gray-400 text-right">{note.length}/140</p>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || sent || selected.size === 0}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {sent
                ? "Sent ✓"
                : sending
                  ? "Sending…"
                  : selected.size > 0
                    ? `Send to ${selected.size}`
                    : "Select a friend"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
