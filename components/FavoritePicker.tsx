"use client";

import { useMemo, useState } from "react";
import { BookDoc, BookFields, addBook, updateBook } from "@/lib/books";
import { useBookSearch, BookResult } from "./useBookSearch";
import { placeholderColor } from "./ShelfView";
import RatingForm from "./RatingForm";

interface FavoritePickerProps {
  userId: string;
  books: BookDoc[];
  onClose: () => void;
  onPickLibrary: (book: BookDoc) => void;
  onCreated: (book: BookDoc) => void;
  onReviewed: (bookId: string, fields: Partial<BookFields>) => void;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function SmallCover({ cover, title }: { cover: string; title: string }) {
  return cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cover} alt="" className="w-9 h-14 object-cover rounded shrink-0 border border-gray-200" />
  ) : (
    <div
      className="w-9 h-14 rounded shrink-0 flex items-center justify-center p-0.5"
      style={{ background: placeholderColor(title) }}
    >
      <span className="text-white/90 text-[7px] text-center leading-tight line-clamp-3">{title}</span>
    </div>
  );
}

export default function FavoritePicker({
  userId,
  books,
  onClose,
  onPickLibrary,
  onCreated,
  onReviewed,
}: FavoritePickerProps) {
  const [query, setQuery] = useState("");
  const { results, searching } = useBookSearch(query);
  const [busy, setBusy] = useState(false);
  // After creating a book that wasn't on the shelf: offer a full review form
  const [rateTarget, setRateTarget] = useState<BookDoc | null>(null);
  const [saving, setSaving] = useState(false);

  const libraryMatches = useMemo(() => {
    const q = norm(query);
    if (q.length < 2) return [];
    return books
      .filter((b) => !b.favorite && `${b.title} ${b.authors}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [books, query]);

  const externalResults = useMemo(
    () =>
      results.filter(
        (r) => !books.some((b) => norm(b.title) === norm(r.title))
      ).slice(0, 6),
    [results, books]
  );

  async function pickExternal(r: BookResult) {
    if (busy) return;
    setBusy(true);
    try {
      const fields: BookFields = {
        title: r.title,
        authors: r.authors,
        year: r.year,
        pages: r.pages,
        cover: r.cover,
        avgRating: r.avgRating,
        source: "",
        myRating: 10, // favourites default to a perfect score
        notes: "",
        cried: false,
        type: "",
        authorCountry: "",
        language: "English",
        originalLanguage: "",
        season: "",
        edition: "",
        favorite: true,
        favoriteOnly: true, // not a full review yet — excluded from recent/wrapped
      };
      const id = await addBook(userId, fields);
      const newBook: BookDoc = { ...fields, id, dateAdded: null };
      onCreated(newBook);
      setRateTarget(newBook);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(values: BookFields) {
    if (!rateTarget || saving) return;
    setSaving(true);
    try {
      // A completed review promotes it out of favourite-only limbo
      const fields: Partial<BookFields> = { ...values, favorite: true, favoriteOnly: false };
      await updateBook(userId, rateTarget.id, fields);
      onReviewed(rateTarget.id, fields);
      onClose();
    } catch (err) {
      console.error("[books] Failed to save review:", err);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-h-[88vh] overflow-y-auto p-5 ${
          rateTarget ? "max-w-lg" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {rateTarget ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <SmallCover cover={rateTarget.cover} title={rateTarget.title} />
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{rateTarget.title}</p>
                  <p className="text-sm text-gray-500 truncate">{rateTarget.authors}</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl shrink-0">✕</button>
            </div>
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Added to your favourites. Want to write a review? Fill this in and it&apos;ll join
              your recent reads — or just close to keep it as a favourite only.
            </p>
            <RatingForm
              onSubmit={submitReview}
              isLoading={saving}
              submitLabel="Save review"
              initialValues={{
                title: rateTarget.title,
                authors: rateTarget.authors,
                year: rateTarget.year,
                pages: rateTarget.pages,
                cover: rateTarget.cover,
                avgRating: rateTarget.avgRating,
                myRating: rateTarget.myRating,
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-800">Pick a favourite</p>
              <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any book, ever…"
              autoFocus
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {libraryMatches.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">From your shelf</p>
                <div className="flex flex-col gap-1">
                  {libraryMatches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        onPickLibrary(b);
                        onClose();
                      }}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-blue-50 text-left"
                    >
                      <SmallCover cover={b.cover} title={b.title} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-800 truncate">{b.title}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {b.authors}{b.myRating > 0 && ` · ★ ${b.myRating}/10`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {externalResults.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">From book search</p>
                <div className="flex flex-col gap-1">
                  {externalResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={busy}
                      onClick={() => pickExternal(r)}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-blue-50 text-left disabled:opacity-50"
                    >
                      <SmallCover cover={r.cover} title={r.title} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-800 truncate">{r.title}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {r.authors}{r.year && ` · ${r.year}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query.trim().length >= 3 && searching && (
              <p className="text-xs text-gray-400">Searching…</p>
            )}
            {query.trim().length >= 3 && !searching && libraryMatches.length === 0 && externalResults.length === 0 && (
              <p className="text-xs text-gray-400">No matches found.</p>
            )}
            {query.trim().length < 3 && (
              <p className="text-xs text-gray-400">
                Type at least 3 letters — your own shelf and the world&apos;s books are both searched.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
