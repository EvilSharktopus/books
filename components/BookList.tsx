"use client";

import { useEffect, useMemo, useState } from "react";
import { BookDoc, BookFields, deleteBook, listBooks, updateBook } from "@/lib/books";

const SORTS = {
  dateAdded: "Date added",
  myRating: "My rating",
  title: "Title A–Z",
  year: "Year",
} as const;

type SortKey = keyof typeof SORTS;

const INPUT_CLASSES =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400";

function formatDate(book: BookDoc): string {
  if (!book.dateAdded) return "";
  return book.dateAdded.toDate().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface BookListProps {
  userId: string;
}

export default function BookList({ userId }: BookListProps) {
  const [books, setBooks] = useState<BookDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("dateAdded");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<BookFields>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBooks(null);
    listBooks(userId)
      .then((b) => {
        if (!cancelled) setBooks(b);
      })
      .catch((err) => {
        console.error("[books] Failed to load books:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load books.");
          setBooks([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const visible = useMemo(() => {
    if (!books) return [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? books.filter((b) =>
          `${b.title}\n${b.authors}\n${b.notes}`.toLowerCase().includes(q)
        )
      : books;
    const sorted = [...filtered];
    switch (sort) {
      case "myRating":
        sorted.sort((a, b) => b.myRating - a.myRating);
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "year":
        sorted.sort(
          (a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0)
        );
        break;
      default:
        // dateAdded desc — the query order; pending serverTimestamps first
        sorted.sort(
          (a, b) => (b.dateAdded?.toMillis() ?? Infinity) - (a.dateAdded?.toMillis() ?? Infinity)
        );
    }
    return sorted;
  }, [books, filter, sort]);

  function startEdit(book: BookDoc) {
    setEditingId(book.id);
    setDraft({
      title: book.title,
      authors: book.authors,
      year: book.year,
      pages: book.pages,
      myRating: book.myRating,
      notes: book.notes,
      cried: book.cried,
    });
  }

  async function saveEdit(bookId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateBook(userId, bookId, draft);
      setBooks(
        (prev) =>
          prev?.map((b) => (b.id === bookId ? { ...b, ...draft } : b)) ?? prev
      );
      setEditingId(null);
    } catch (err) {
      console.error("[books] Failed to update book:", err);
      setError(err instanceof Error ? err.message : "Failed to update book.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(book: BookDoc) {
    if (busy) return;
    if (!window.confirm(`Delete "${book.title}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBook(userId, book.id);
      setBooks((prev) => prev?.filter((b) => b.id !== book.id) ?? prev);
    } catch (err) {
      console.error("[books] Failed to delete book:", err);
      setError(err instanceof Error ? err.message : "Failed to delete book.");
    } finally {
      setBusy(false);
    }
  }

  if (books === null) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading books…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by title, author, or notes…"
          className={`${INPUT_CLASSES} flex-1`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort" className="text-xs font-medium text-gray-500">
            Sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={INPUT_CLASSES}
          >
            {(Object.entries(SORTS) as [SortKey, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {visible.length} book{visible.length === 1 ? "" : "s"}
        {filter.trim() && books.length !== visible.length && ` (of ${books.length})`}
      </p>

      {books.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No books filed yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((book) => {
            const expanded = expandedId === book.id;
            const editing = editingId === book.id;
            return (
              <li
                key={book.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(expanded ? null : book.id);
                    if (editingId !== book.id) setEditingId(null);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50"
                >
                  {book.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.cover}
                      alt=""
                      className="w-8 h-12 object-cover rounded-sm border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-12 rounded-sm border border-dashed border-gray-300 shrink-0 flex items-center justify-center text-xs text-gray-300">
                      ?
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-800 truncate">
                      {book.title}
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {book.authors}
                      {book.year && ` · ${book.year}`}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {book.myRating > 0 && (
                      <span className="block text-sm text-amber-500 font-medium whitespace-nowrap">
                        ★ {book.myRating}/10
                      </span>
                    )}
                    <span className="block text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(book)}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="px-3 py-3 border-t border-gray-100 bg-gray-50 text-sm">
                    {editing ? (
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={draft.title ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                            placeholder="Title"
                            className={INPUT_CLASSES}
                          />
                          <input
                            value={draft.authors ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, authors: e.target.value }))}
                            placeholder="Author(s)"
                            className={INPUT_CLASSES}
                          />
                          <input
                            value={draft.year ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))}
                            placeholder="Year"
                            inputMode="numeric"
                            className={INPUT_CLASSES}
                          />
                          <input
                            value={draft.pages ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, pages: e.target.value }))}
                            placeholder="Pages"
                            inputMode="numeric"
                            className={INPUT_CLASSES}
                          />
                          <select
                            value={draft.myRating ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, myRating: parseInt(e.target.value, 10) }))
                            }
                            className={INPUT_CLASSES}
                            aria-label="My rating"
                          >
                            <option value={0}>No rating</option>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                ★ {n}/10
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-gray-700 px-1">
                            <input
                              type="checkbox"
                              checked={draft.cried ?? false}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, cried: e.target.checked }))
                              }
                              className="w-4 h-4 accent-blue-600"
                            />
                            Cried while reading
                          </label>
                        </div>
                        <textarea
                          value={draft.notes ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                          placeholder="Notes"
                          rows={3}
                          className={`${INPUT_CLASSES} resize-none`}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(book.id)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {book.notes ? (
                          <p className="text-gray-700 whitespace-pre-wrap">{book.notes}</p>
                        ) : (
                          <p className="text-gray-400 italic">No notes.</p>
                        )}
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-500">
                          {book.pages && <div><dt className="inline font-medium">Pages: </dt><dd className="inline">{book.pages}</dd></div>}
                          {book.type && <div><dt className="inline font-medium">Type: </dt><dd className="inline">{book.type}</dd></div>}
                          {book.authorCountry && <div><dt className="inline font-medium">Author country: </dt><dd className="inline">{book.authorCountry}</dd></div>}
                          {book.source && <div><dt className="inline font-medium">Heard from: </dt><dd className="inline">{book.source}</dd></div>}
                          {book.avgRating != null && <div><dt className="inline font-medium">Public avg: </dt><dd className="inline">★{book.avgRating}</dd></div>}
                          {book.cried && <div><dd className="inline">Cried while reading 💧</dd></div>}
                        </dl>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => startEdit(book)}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(book)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
