"use client";

import { useCallback, useEffect, useState } from "react";
import { BookDoc, BookFields, deleteBook, listBooks, setFavorite, updateBook } from "@/lib/books";
import { useCoverBackfill } from "./useCoverBackfill";
import { hasAnyFilter, EMPTY_FILTERS, useFilteredBooks, SortState } from "./useFilteredBooks";
import BookFilters from "./BookFilters";
import ShelfView from "./ShelfView";
import TableView from "./TableView";
import BookDetailModal from "./BookDetailModal";
import FavoritePicker from "./FavoritePicker";
import RecommendModal from "./RecommendModal";
import { listSentForBook } from "@/lib/recommendations";
import { useLocalStorage } from "./useLocalStorage";

// Dropdown sort options; table-header sorts outside this set show "Custom"
const SORT_OPTIONS: { id: string; label: string; sort: SortState }[] = [
  { id: "dateAdded", label: "Date added", sort: { key: "dateAdded", dir: "desc" } },
  { id: "myRating", label: "My rating", sort: { key: "myRating", dir: "desc" } },
  { id: "title", label: "Title A–Z", sort: { key: "title", dir: "asc" } },
  { id: "year", label: "Year", sort: { key: "year", dir: "desc" } },
];

type ViewMode = "list" | "shelf" | "table";
const VIEWS: { id: ViewMode; icon: string; label: string }[] = [
  { id: "list", icon: "☰", label: "List" },
  { id: "shelf", icon: "▦", label: "Shelf" },
  { id: "table", icon: "⊞", label: "Table" },
];

const INPUT_CLASSES =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400";

function formatDate(book: BookDoc): string {
  if (!book.dateAdded) return "";
  const date = book.dateAdded.toDate();
  // Imported books whose original review had no timestamp carry a sentinel
  // old date so they sort last under "Date added".
  if (date.getFullYear() < 2025) return "Pre-2025";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface BookListProps {
  userId: string;
  userName: string;
}

export default function BookList({ userId, userName }: BookListProps) {
  const [books, setBooks] = useState<BookDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { search, setSearch, sort, setSort, filters, setFilters, schema, filtered, total } =
    useFilteredBooks(books);
  const [storedView, setStoredView] = useLocalStorage("bookRatings.viewMode");
  const view: ViewMode =
    storedView === "shelf" || storedView === "table" ? storedView : "list";
  const [detailBook, setDetailBook] = useState<BookDoc | null>(null);
  const [pickingFavorite, setPickingFavorite] = useState(false);
  const [recommending, setRecommending] = useState<BookDoc | null>(null);
  const [recCounts, setRecCounts] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<BookFields>>({});
  const [busy, setBusy] = useState(false);
  const [coverEditId, setCoverEditId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  // Resize an uploaded image to cover size and return a compact data URL,
  // small enough to live inside the Firestore document.
  function fileToCoverDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 300 / img.width, 450 / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image"));
      };
      img.src = url;
    });
  }

  async function saveCoverUrl(bookId: string) {
    const url = coverUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return;
    setBusy(true);
    try {
      await updateBook(userId, bookId, { cover: url });
      setBooks((prev) =>
        prev ? prev.map((b) => (b.id === bookId ? { ...b, cover: url } : b)) : prev
      );
      setCoverEditId(null);
      setCoverUrl("");
    } catch (err) {
      console.error("[books] Failed to save cover:", err);
      setError(err instanceof Error ? err.message : "Failed to save cover.");
    } finally {
      setBusy(false);
    }
  }

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

  const onCoverFound = useCallback(
    (bookId: string, cover: string, avgRating: number | null) => {
      setBooks((prev) =>
        prev
          ? prev.map((b) =>
              b.id === bookId
                ? { ...b, cover, avgRating: avgRating ?? b.avgRating }
                : b
            )
          : prev
      );
    },
    []
  );
  const coverProgress = useCoverBackfill(userId, books, onCoverFound);

  const visible = filtered;

  // Table-header sorting: click toggles direction, syncs with the dropdown
  function handleColumnSort(key: string) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "title" || key === "authors" ? "asc" : "desc" }
    );
  }

  const dropdownValue =
    SORT_OPTIONS.find((o) => o.sort.key === sort.key && o.sort.dir === sort.dir)?.id ?? "custom";

  function clearAllFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
  }

  // How many people the current user has recommended the open book to
  const refreshRecCount = useCallback(
    (bookId: string) => {
      listSentForBook(userId, bookId)
        .then((recs) => setRecCounts((prev) => ({ ...prev, [bookId]: recs.length })))
        .catch((err) => console.error("[recs] count failed:", err));
    },
    [userId]
  );

  useEffect(() => {
    if (detailBook) refreshRecCount(detailBook.id);
  }, [detailBook, refreshRecCount]);

  async function toggleFavorite(book: BookDoc) {
    if (!books) return;
    const next = !book.favorite;
    if (next && books.filter((b) => b.favorite).length >= 4) {
      setError("You can have at most 4 favourites — remove one first.");
      return;
    }
    setError(null);
    try {
      await setFavorite(userId, book.id, next);
      setBooks((prev) =>
        prev ? prev.map((b) => (b.id === book.id ? { ...b, favorite: next } : b)) : prev
      );
      setDetailBook((prev) => (prev && prev.id === book.id ? { ...prev, favorite: next } : prev));
    } catch (err) {
      console.error("[books] Failed to toggle favourite:", err);
      setError(err instanceof Error ? err.message : "Failed to update favourite.");
    }
  }

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
      language: book.language,
      cover: book.cover,
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title, author, or notes…"
          className={`${INPUT_CLASSES} flex-1`}
        />
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort" className="text-xs font-medium text-gray-500">
            Sort by
          </label>
          <select
            id="sort"
            value={dropdownValue}
            onChange={(e) => {
              const opt = SORT_OPTIONS.find((o) => o.id === e.target.value);
              if (opt) setSort(opt.sort);
            }}
            className={INPUT_CLASSES}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
            {dropdownValue === "custom" && <option value="custom">Custom</option>}
          </select>
          <div
            className="flex rounded-lg border border-gray-300 overflow-hidden shrink-0"
            role="radiogroup"
            aria-label="View"
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={view === v.id}
                onClick={() => setStoredView(v.id)}
                className={`px-2.5 py-2 text-xs font-medium flex items-center gap-1 ${
                  view === v.id
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span aria-hidden>{v.icon}</span>
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <BookFilters
        books={books}
        schema={schema}
        filters={filters}
        setFilters={setFilters}
        resultCount={visible.length}
        total={total}
      />

      {coverProgress && (
        <p className="text-xs text-gray-400">
          {coverProgress.finished
            ? `Cover lookup finished: found ${coverProgress.found} of ${coverProgress.total} missing covers.`
            : `Looking up missing covers… ${coverProgress.done}/${coverProgress.total} (${coverProgress.found} found)`}
          {coverProgress.lastError && ` — last error: ${coverProgress.lastError}`}
        </p>
      )}

      {books.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No books filed yet.
        </p>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-3">
          <p className="text-3xl">🔍</p>
          <p className="text-sm text-gray-500">No books match those filters.</p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            Clear filters
          </button>
        </div>
      ) : view === "shelf" ? (
        <ShelfView
          books={visible}
          allBooks={books}
          schema={schema}
          onOpen={setDetailBook}
          onAddFavorite={() => setPickingFavorite(true)}
        />
      ) : view === "table" ? (
        <TableView
          books={visible}
          schema={schema}
          sort={sort}
          onSort={handleColumnSort}
          onOpen={setDetailBook}
        />
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
                        <div className="flex items-center gap-3">
                          {draft.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={draft.cover} alt="" className="w-10 h-[60px] object-cover rounded border border-gray-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-[60px] rounded border border-dashed border-gray-300 shrink-0" />
                          )}
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <input
                              type="url"
                              value={draft.cover?.startsWith("data:") ? "" : draft.cover ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...d, cover: e.target.value }))}
                              placeholder={draft.cover?.startsWith("data:") ? "Uploaded image in use — paste a URL to replace" : "Cover image URL…"}
                              className={INPUT_CLASSES}
                            />
                            <label className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 cursor-pointer w-fit">
                              …or upload an image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const dataUrl = await fileToCoverDataUrl(file);
                                    setDraft((d) => ({ ...d, cover: dataUrl }));
                                  } catch {
                                    setError("Couldn't read that image — try a different file.");
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
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
                            value={draft.language ?? "English"}
                            onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}
                            className={INPUT_CLASSES}
                          >
                            <option value="English">English</option>
                            <option value="Translated">Translated</option>
                          </select>
                          <select
                            value={draft.authorGender ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, authorGender: e.target.value }))}
                            className={INPUT_CLASSES}
                            aria-label="Author gender"
                          >
                            <option value="">Author gender…</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
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
                          {book.language && book.language !== "English" && <div><dt className="inline font-medium">Language: </dt><dd className="inline">{book.language}{book.originalLanguage && ` (from ${book.originalLanguage})`}</dd></div>}
                          {book.season && <div><dt className="inline font-medium">Season: </dt><dd className="inline">{book.season}</dd></div>}
                          {book.edition && <div><dt className="inline font-medium">Edition: </dt><dd className="inline">{book.edition}</dd></div>}
                          {book.authorCountry && <div><dt className="inline font-medium">Author country: </dt><dd className="inline">{book.authorCountry}</dd></div>}
                          {book.authorGender && <div><dt className="inline font-medium">Author gender: </dt><dd className="inline">{book.authorGender}</dd></div>}
                          {book.source && <div><dt className="inline font-medium">Heard from: </dt><dd className="inline">{book.source}</dd></div>}
                          {book.avgRating != null && <div><dt className="inline font-medium">Public avg: </dt><dd className="inline">★{(book.avgRating * 2).toFixed(1)}/10</dd></div>}
                          {book.cried && <div><dd className="inline">Cried while reading 💧</dd></div>}
                        </dl>
                        {!book.cover && coverEditId !== book.id && (
                          <button
                            onClick={() => {
                              setCoverEditId(book.id);
                              setCoverUrl("");
                            }}
                            className="self-start text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
                          >
                            Add cover image
                          </button>
                        )}
                        {coverEditId === book.id && (
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={coverUrl}
                              onChange={(e) => setCoverUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveCoverUrl(book.id);
                                }
                              }}
                              placeholder="Paste image URL…"
                              autoFocus
                              className={`${INPUT_CLASSES} flex-1 min-w-0`}
                            />
                            <button
                              onClick={() => saveCoverUrl(book.id)}
                              disabled={busy || !/^https?:\/\/\S+$/i.test(coverUrl.trim())}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setCoverEditId(null)}
                              className="px-2 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
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

      {pickingFavorite && books && (
        <FavoritePicker
          userId={userId}
          books={books}
          onClose={() => setPickingFavorite(false)}
          onPickLibrary={(book) => {
            setFavorite(userId, book.id, true).catch((err) =>
              console.error("[books] Failed to favourite:", err)
            );
            setBooks((prev) =>
              prev ? prev.map((b) => (b.id === book.id ? { ...b, favorite: true } : b)) : prev
            );
          }}
          onCreated={(newBook) => setBooks((prev) => (prev ? [newBook, ...prev] : prev))}
          onReviewed={(bookId, fields) =>
            setBooks((prev) =>
              prev ? prev.map((b) => (b.id === bookId ? { ...b, ...fields } : b)) : prev
            )
          }
        />
      )}

      {recommending && (
        <RecommendModal
          book={recommending}
          fromUser={{ id: userId, name: userName }}
          onClose={() => setRecommending(null)}
          onSent={() => refreshRecCount(recommending.id)}
        />
      )}

      {detailBook && (() => {
        const idx = visible.findIndex((b) => b.id === detailBook.id);
        const many = visible.length > 1 && idx !== -1;
        return (
          <BookDetailModal
            book={detailBook}
            onClose={() => setDetailBook(null)}
            onPrev={many ? () => setDetailBook(visible[(idx - 1 + visible.length) % visible.length]) : undefined}
            onNext={many ? () => setDetailBook(visible[(idx + 1) % visible.length]) : undefined}
            onToggleFavorite={() => toggleFavorite(detailBook)}
            onRecommend={() => setRecommending(detailBook)}
            recommendCount={recCounts[detailBook.id] ?? 0}
          />
        );
      })()}
    </div>
  );
}
