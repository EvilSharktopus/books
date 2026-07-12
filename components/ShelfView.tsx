"use client";

import { useState } from "react";
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium tracking-[0.18em] text-gray-400 uppercase mb-3">
      {children}
    </p>
  );
}

function CoverArt({ book }: { book: BookDoc }) {
  return book.cover ? (
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
  );
}

/** A cover cell: cover art, optional signal chips, "8 ★" rating line below. */
function BookCell({
  book,
  schema,
  onOpen,
  showRating = true,
}: {
  book: BookDoc;
  schema: FieldDef[];
  onOpen: (book: BookDoc) => void;
  showRating?: boolean;
}) {
  const hasCried = schema.some((f) => f.key === "cried");
  const hasLanguage = schema.some((f) => f.key === "language");
  const translated = hasLanguage && book.language && book.language !== "English";
  return (
    <button
      type="button"
      onClick={() => onOpen(book)}
      title={`${book.title} — ${book.authors}`}
      className="text-left group"
    >
      <div
        className="relative rounded-md border border-black/10 overflow-hidden shadow-sm transition-transform group-hover:scale-[1.03]"
        style={{ aspectRatio: "2/3" }}
      >
        <CoverArt book={book} />
        {(book.cried && hasCried) || translated ? (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-gray-900/70 rounded px-1 py-0.5 text-[11px] leading-none">
            {book.cried && hasCried && <span title="Cried while reading">💧</span>}
            {translated && (
              <span
                title={`Translated${book.originalLanguage ? ` from ${book.originalLanguage}` : ""}`}
                className="text-white/90 font-bold"
              >
                T
              </span>
            )}
          </span>
        ) : null}
      </div>
      {showRating && (
        <p className="flex items-center gap-1 text-sm text-gray-400 mt-1.5 leading-none">
          {book.myRating > 0 && (
            <span className="font-semibold">
              {book.myRating} <span className="text-amber-400">★</span>
            </span>
          )}
          {book.notes && (
            <span className="text-gray-300 text-base leading-none" title="Has a review">
              ≡
            </span>
          )}
        </p>
      )}
    </button>
  );
}

export default function ShelfView({
  books,
  allBooks,
  schema,
  onOpen,
  onAddFavorite,
}: {
  books: BookDoc[]; // filtered + sorted
  allBooks: BookDoc[];
  schema: FieldDef[];
  onOpen: (book: BookDoc) => void;
  onAddFavorite?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const favorites = allBooks.filter((b) => b.favorite).slice(0, 4);
  const recent = [...allBooks]
    .sort((a, b) => (b.dateAdded?.toMillis() ?? 0) - (a.dateAdded?.toMillis() ?? 0))
    .slice(0, 4);

  if (showAll) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
        >
          <span className="text-lg leading-none">‹</span> Back to overview
        </button>
        <div
          className="grid gap-x-3 gap-y-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(110px, 28vw), 1fr))" }}
        >
          {books.map((book) => (
            <BookCell key={book.id} book={book} schema={schema} onOpen={onOpen} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2">
        <SectionHeader>Favourites</SectionHeader>
        <div className="grid grid-cols-4 gap-3">
          {favorites.map((book) => (
            <BookCell key={book.id} book={book} schema={schema} onOpen={onOpen} showRating={false} />
          ))}
          {Array.from({ length: 4 - favorites.length }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={onAddFavorite}
              disabled={!onAddFavorite}
              aria-label="Add a favourite"
              className="rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-amber-300 hover:text-amber-400 transition-colors"
              style={{ aspectRatio: "2/3" }}
            >
              <span className="text-2xl">☆</span>
            </button>
          ))}
        </div>
        {favorites.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">
            No favourites selected yet — tap a ☆ slot to search and pick one.
          </p>
        )}
      </div>

      <hr className="my-6 border-gray-200" />

      <div>
        <SectionHeader>Recent activity</SectionHeader>
        <div className="grid grid-cols-4 gap-3">
          {recent.map((book) => (
            <BookCell key={book.id} book={book} schema={schema} onOpen={onOpen} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="mt-8 flex items-center justify-between w-full text-left text-lg font-medium text-gray-500 hover:text-gray-700"
      >
        More activity
        <span className="text-xl">›</span>
      </button>
    </div>
  );
}
