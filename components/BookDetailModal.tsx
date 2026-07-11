"use client";

import { useEffect } from "react";
import { BookDoc } from "@/lib/books";

function formatDate(book: BookDoc): string {
  if (!book.dateAdded) return "";
  const date = book.dateAdded.toDate();
  if (date.getFullYear() < 2025) return "Pre-2025";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function BookDetailModal({
  book,
  onClose,
  onPrev,
  onNext,
  onToggleFavorite,
}: {
  book: BookDoc;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToggleFavorite?: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext, onClose]);

  const fields: [string, string][] = [];
  if (book.type) fields.push(["Type", book.type]);
  if (book.language && book.language !== "English")
    fields.push(["Language", book.originalLanguage ? `${book.language} (from ${book.originalLanguage})` : book.language]);
  if (book.season) fields.push(["Season", book.season]);
  if (book.edition) fields.push(["Edition", book.edition]);
  if (book.authorCountry) fields.push(["Author country", book.authorCountry]);
  if (book.year) fields.push(["Year", book.year]);
  if (book.pages) fields.push(["Pages", book.pages]);
  if (book.source) fields.push(["Heard from", book.source]);
  if (book.avgRating != null) fields.push(["Public avg", `★${(book.avgRating * 2).toFixed(1)}/10`]);
  const added = formatDate(book);
  if (added) fields.push(["Added", added]);

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {onPrev && (
        <button
          type="button"
          aria-label="Previous book"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/25 backdrop-blur-[2px] shadow text-gray-600/70 text-xl font-bold hover:bg-white/80 hover:text-gray-700 flex items-center justify-center z-10"
        >
          ‹
        </button>
      )}
      {onNext && (
        <button
          type="button"
          aria-label="Next book"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/25 backdrop-blur-[2px] shadow text-gray-600/70 text-xl font-bold hover:bg-white/80 hover:text-gray-700 flex items-center justify-center z-10"
        >
          ›
        </button>
      )}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >
          ✕
        </button>
        <div className="flex gap-4 mb-4">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover} alt="" className="w-20 h-[120px] object-cover rounded-md border border-gray-200 shrink-0" />
          ) : (
            <div className="w-20 h-[120px] rounded-md border border-dashed border-gray-300 shrink-0" />
          )}
          <div className="min-w-0 pr-6">
            <h3 className="text-lg font-bold text-gray-900">{book.title}</h3>
            <p className="text-sm text-gray-500 mb-2">{book.authors}</p>
            {book.myRating > 0 && (
              <p className="text-amber-500 font-bold">★ {book.myRating}/10</p>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`mt-2 flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1 border transition-colors ${
                  book.favorite
                    ? "bg-amber-50 border-amber-300 text-amber-600"
                    : "bg-white border-gray-300 text-gray-500 hover:border-amber-300 hover:text-amber-600"
                }`}
              >
                <span className={book.favorite ? "text-amber-400" : "text-gray-300"}>★</span>
                {book.favorite ? "Favourite" : "Add to favourites"}
              </button>
            )}
            {book.cried && <p className="text-sm text-gray-500 mt-1">Cried while reading 💧</p>}
          </div>
        </div>
        {book.notes && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{book.notes}</p>
        )}
        {fields.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500 border-t border-gray-100 pt-3">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="inline font-medium">{label}: </dt>
                <dd className="inline">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
