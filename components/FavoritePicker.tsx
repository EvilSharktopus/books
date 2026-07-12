"use client";

import { useMemo, useState } from "react";
import { BookDoc, BookFields, addBook, updateBook } from "@/lib/books";
import { useBookSearch, BookResult } from "./useBookSearch";
import { placeholderColor } from "./ShelfView";

interface FavoritePickerProps {
  userId: string;
  books: BookDoc[];
  onClose: () => void;
  onPickLibrary: (book: BookDoc) => void;
  onCreated: (book: BookDoc) => void;
  onRated: (bookId: string, myRating: number) => void;
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
  onRated,
}: FavoritePickerProps) {
  const [query, setQuery] = useState("");
  const { results, searching } = useBookSearch(query);
  const [busy, setBusy] = useState(false);
  // After creating a book that wasn't on the shelf: offer to adjust the auto 10★
  const [rateTarget, setRateTarget] = useState<BookDoc | null>(null);
  const [rating, setRating] = useState(10);

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
      };
      const id = await addBook(userId, fields);
      const newBook: BookDoc = { ...fields, id, dateAdded: null };
      onCreated(newBook);
      setRating(10);
      setRateTarget(newBook);
    } finally {
      setBusy(false);
    }
  }

  async function saveRating() {
    if (!rateTarget) return;
    if (rating !== rateTarget.myRating) {
      await updateBook(userId, rateTarget.id, { myRating: rating });
      onRated(rateTarget.id, rating);
    }
    onClose();
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
        {rateTarget ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <SmallCover cover={rateTarget.cover} title={rateTarget.title} />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{rateTarget.title}</p>
                <p className="text-sm text-gray-500 truncate">{rateTarget.authors}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              Added to your favourites and rated <span className="text-amber-500 font-bold">★ 10/10</span> —
              it&apos;s a favourite, after all. Do you want to rate this book yourself?
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="fav-rating" className="text-sm text-gray-600">My rating:</label>
              <select
                id="fav-rating"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-amber-400">★</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
              >
                Keep 10 ★
              </button>
              <button
                type="button"
                onClick={saveRating}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
              >
                Save rating
              </button>
            </div>
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
