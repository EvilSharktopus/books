"use client";

import { BookDoc } from "@/lib/books";
import { FieldDef } from "./useFilteredBooks";

// Deterministic placeholder color from the title, stable across renders
const PLACEHOLDER_COLORS = [
  "#4c5b8f", "#6b4c8f", "#8f4c6b", "#8f6b4c", "#4c8f6b",
  "#4c6b8f", "#7a5c3d", "#3d6b7a", "#5c3d7a", "#3d7a5c",
];

export function placeholderColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

function authorLastName(authors: string): string {
  const first = authors.split(",")[0].trim();
  const parts = first.split(/\s+/);
  return parts[parts.length - 1] || first;
}

export default function ShelfView({
  books,
  allBooks,
  schema,
  onOpen,
}: {
  books: BookDoc[];
  allBooks: BookDoc[];
  schema: FieldDef[];
  onOpen: (book: BookDoc) => void;
}) {
  const hasCried = schema.some((f) => f.key === "cried");
  const hasLanguage = schema.some((f) => f.key === "language");
  const favorites = allBooks.filter((b) => b.favorite).slice(0, 4);

  return (
    <div className="flex flex-col">
    {favorites.length > 0 && (
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-3">
          Favourites
        </p>
        <div className="grid grid-cols-4 gap-3">
          {favorites.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onOpen(book)}
              title={`${book.title} — ${book.authors}`}
              className="group"
            >
              <div
                className="relative rounded-md border border-black/10 overflow-hidden shadow-md transition-transform group-hover:scale-[1.03]"
                style={{ aspectRatio: "2/3" }}
              >
                {book.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-2"
                    style={{ background: placeholderColor(book.title) }}
                  >
                    <span className="text-white/90 text-xs font-medium text-center leading-tight line-clamp-5">
                      {book.title}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        <hr className="mt-6 border-gray-200" />
      </div>
    )}
    <div
      className="grid gap-x-3 gap-y-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(110px, 28vw), 1fr))" }}
    >
      {books.map((book) => {
        const translated = hasLanguage && book.language && book.language !== "English";
        return (
          <button
            key={book.id}
            type="button"
            onClick={() => onOpen(book)}
            title={`${book.title} — ${book.authors}`}
            className="text-left group"
          >
            <div className="relative rounded border border-black/10 overflow-hidden transition-transform group-hover:scale-[1.03] shadow-sm" style={{ aspectRatio: "2/3" }}>
              {book.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center p-2"
                  style={{ background: placeholderColor(book.title) }}
                >
                  <span className="text-white/90 text-[11px] font-medium text-center leading-tight line-clamp-5">
                    {book.title}
                  </span>
                </div>
              )}
              {book.myRating > 0 && (
                <span className="absolute top-1 right-1 bg-gray-900/80 text-amber-300 text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {book.myRating}
                </span>
              )}
              {(book.cried && hasCried) || translated || book.favorite ? (
                <span className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-gray-900/70 rounded px-1 py-0.5 text-[11px] leading-none">
                  {book.favorite && <span title="Favourite" className="text-amber-300">★</span>}
                  {book.cried && hasCried && <span title="Cried while reading">💧</span>}
                  {translated && (
                    <span title={`Translated${book.originalLanguage ? ` from ${book.originalLanguage}` : ""}`} className="text-white/90 font-bold">
                      T
                    </span>
                  )}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 truncate mt-1">{authorLastName(book.authors)}</p>
          </button>
        );
      })}
    </div>
    </div>
  );
}
