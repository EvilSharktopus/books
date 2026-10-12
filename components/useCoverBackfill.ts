"use client";

import { useEffect, useRef, useState } from "react";
import { BookDoc, updateBook } from "@/lib/books";
import { storableCover } from "@/lib/coverUrl";

export interface BackfillProgress {
  total: number;
  done: number;
  found: number;
  finished: boolean;
  lastError: string | null;
}

// Book ids we already tried and found nothing for, so page reloads don't
// re-query the same misses forever (persisted per browser). Covers and page
// counts are tracked separately: a book can have one without the other.
const MISS_KEY = "bookRatings.coverMisses.v6";
const PAGES_MISS_KEY = "bookRatings.pagesMisses.v1";

function loadMisses(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveMiss(key: string, id: string) {
  try {
    const misses = loadMisses(key);
    misses.add(id);
    localStorage.setItem(key, JSON.stringify([...misses]));
  } catch {
    // storage unavailable — we'll just retry next visit
  }
}

interface CoverHit {
  cover: string;
  avgRating: number | null;
  pages: string; // "" when the source didn't know
}

export interface FilledFields {
  cover?: string;
  avgRating?: number;
  pages?: string;
}

// Thrown when the API request itself failed (rate limit, network) — the
// book must NOT be marked as a permanent miss in that case.
class LookupFailed extends Error {}

// Drop subtitles/parentheticals that spoil exact matching,
// e.g. "An american marriage: a novel" or "Slumdog Millionaire (Q&A)".
function cleanTitle(title: string): string {
  return title.split(/[:(]|\s-\s/)[0].replace(/\s+/g, " ").trim();
}

async function googleLookup(
  q: string,
  signal: AbortSignal
): Promise<CoverHit | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`,
    { signal }
  );
  if (!res.ok) throw new LookupFailed(`google ${res.status}`);
  const data = await res.json();
  const item = (data.items ?? []).find(
    (i: { volumeInfo?: { imageLinks?: object } }) => i.volumeInfo?.imageLinks
  );
  if (!item) return null;
  const v = item.volumeInfo;
  return {
    pages: v.pageCount ? String(v.pageCount) : "",
    cover: storableCover(
      v.imageLinks.thumbnail ?? v.imageLinks.smallThumbnail ?? ""
    ),
    avgRating: v.averageRating ?? null,
  };
}

async function openLibraryLookup(
  title: string,
  author: string,
  signal: AbortSignal
): Promise<CoverHit | null> {
  const params = new URLSearchParams({
    title,
    limit: "20",
    fields: "cover_i,ratings_average,number_of_pages_median",
  });
  if (author) params.set("author", author);
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal,
  });
  if (!res.ok) throw new LookupFailed(`openlibrary ${res.status}`);
  const data = await res.json();
  const docs: {
    cover_i?: number;
    ratings_average?: number;
    number_of_pages_median?: number;
  }[] = data.docs ?? [];
  const doc = docs.find((d) => d.cover_i);
  if (!doc) return null;
  // The cover edition often lacks a page count; borrow the first match's.
  const pages =
    doc.number_of_pages_median ??
    docs.find((d) => d.number_of_pages_median)?.number_of_pages_median;
  return {
    pages: pages ? String(pages) : "",
    cover: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
    avgRating: doc.ratings_average
      ? Math.round(doc.ratings_average * 10) / 10
      : null,
  };
}

// Resolves to a hit, or null for a genuine "no cover exists" (at least one
// search completed and found nothing). Throws LookupFailed when every
// attempt errored — rate limits etc. — so callers can retry later instead
// of blacklisting the book.
async function findCover(
  title: string,
  authors: string,
  signal: AbortSignal
): Promise<CoverHit | null> {
  const clean = cleanTitle(title);
  // "Didion & Babitz" vs "Didion and Babitz" — indexes disagree, try both.
  const ampSwapped = title.includes("&")
    ? title.replace(/\s*&\s*/g, " and ")
    : title.match(/\band\b/i)
      ? title.replace(/\band\b/i, "&")
      : null;
  // Progressively looser: exact matches first, then without the (possibly
  // misspelled) author, then subtitle stripped, then general keyword
  // searches, which tolerate typos in the source spreadsheet.
  const attempts: (() => Promise<CoverHit | null>)[] = [
    () => googleLookup(`intitle:"${title}" ${authors}`.trim(), signal),
    () => openLibraryLookup(title, authors, signal),
    () => openLibraryLookup(title, "", signal),
    ...(ampSwapped ? [() => openLibraryLookup(ampSwapped, "", signal)] : []),
    ...(clean !== title
      ? [() => openLibraryLookup(clean, "", signal)]
      : []),
    () => googleLookup(`${clean} ${authors}`.trim(), signal),
    () => googleLookup(clean, signal),
  ];
  let anySucceeded = false;
  for (const attempt of attempts) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const hit = await attempt();
      anySucceeded = true;
      if (hit?.cover) return hit;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      // LookupFailed or network error — try the next source
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!anySucceeded) throw new LookupFailed("all sources failed");
  return null;
}

// Page count only (the book already has a cover). Open Library first since
// it has no daily quota, Google Books as the fallback. Same null/throw
// contract as findCover.
async function findPages(
  title: string,
  authors: string,
  signal: AbortSignal
): Promise<string | null> {
  const clean = cleanTitle(title);
  const attempts: (() => Promise<string | null>)[] = [
    () => openLibraryPages(title, authors, signal),
    () => openLibraryPages(clean, "", signal),
    async () =>
      (await googleLookup(`intitle:"${clean}" ${authors}`.trim(), signal))
        ?.pages || null,
  ];
  let anySucceeded = false;
  for (const attempt of attempts) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const pages = await attempt();
      anySucceeded = true;
      if (pages) return pages;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!anySucceeded) throw new LookupFailed("all sources failed");
  return null;
}

async function openLibraryPages(
  title: string,
  author: string,
  signal: AbortSignal
): Promise<string | null> {
  const params = new URLSearchParams({
    title,
    limit: "10",
    fields: "number_of_pages_median",
  });
  if (author) params.set("author", author);
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal,
  });
  if (!res.ok) throw new LookupFailed(`openlibrary ${res.status}`);
  const data = await res.json();
  const doc = (data.docs ?? []).find(
    (d: { number_of_pages_median?: number }) => d.number_of_pages_median
  );
  return doc ? String(doc.number_of_pages_median) : null;
}

// Quietly fills in missing covers and page counts while the list is open:
// one lookup at a time, saved to Firestore and reflected in the list as
// they land.
export function useCoverBackfill(
  userId: string,
  books: BookDoc[] | null,
  onFilled: (bookId: string, fields: FilledFields) => void
): BackfillProgress | null {
  const [progress, setProgress] = useState<BackfillProgress | null>(null);
  const running = useRef(false);
  const booksRef = useRef(books);
  useEffect(() => {
    booksRef.current = books;
  }, [books]);
  const hasBooks = books !== null;

  useEffect(() => {
    const snapshot = booksRef.current;
    if (!hasBooks || !snapshot || running.current) return;
    const coverMisses = loadMisses(MISS_KEY);
    const pageMisses = loadMisses(PAGES_MISS_KEY);
    const needsCover = (b: BookDoc) => !b.cover && !coverMisses.has(b.id);
    const needsPages = (b: BookDoc) =>
      !b.pages && !b.favoriteOnly && !pageMisses.has(b.id);
    // Newest first, so this year's books (the ones Wrapped counts) are
    // filled before the long tail of imported backlog entries.
    const queue = snapshot
      .filter((b) => b.title && (needsCover(b) || needsPages(b)))
      .sort(
        (a, b) =>
          (b.dateAdded?.toMillis() ?? 0) - (a.dateAdded?.toMillis() ?? 0)
      );
    if (queue.length === 0) return;

    running.current = true;
    const controller = new AbortController();
    const state: BackfillProgress = {
      total: queue.length,
      done: 0,
      found: 0,
      finished: false,
      lastError: null,
    };
    setProgress({ ...state });

    (async () => {
      for (const book of queue) {
        try {
          const fields: FilledFields = {};
          if (needsCover(book)) {
            const hit = await findCover(book.title, book.authors, controller.signal);
            if (hit?.cover) {
              fields.cover = hit.cover;
              if (hit.avgRating != null && book.avgRating == null)
                fields.avgRating = hit.avgRating;
              if (hit.pages && !book.pages) fields.pages = hit.pages;
            } else {
              // Searches ran and found nothing — a real miss, don't retry.
              saveMiss(MISS_KEY, book.id);
            }
          }
          if (needsPages(book) && !fields.pages) {
            const pages = await findPages(book.title, book.authors, controller.signal);
            if (pages) fields.pages = pages;
            else saveMiss(PAGES_MISS_KEY, book.id);
          }
          if (controller.signal.aborted) return;
          if (Object.keys(fields).length > 0) {
            await updateBook(userId, book.id, fields);
            onFilled(book.id, fields);
            state.found++;
          }
          state.done++;
          setProgress({ ...state });
        } catch (e) {
          if (e instanceof LookupFailed) {
            // APIs are angry (rate limits) — back off but keep the book
            // eligible for a later pass.
            state.lastError = (e as Error).message;
            state.done++;
            setProgress({ ...state });
            console.warn(`[covers] ${book.title}: ${(e as Error).message}`);
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }
          return; // aborted or offline — stop quietly, next visit resumes
        }
        await new Promise((r) => setTimeout(r, 700));
        if (controller.signal.aborted) return;
      }
      state.finished = true;
      setProgress({ ...state });
    })().finally(() => {
      running.current = false;
    });

    return () => controller.abort();
    // Deliberately not keyed on `books` — cover updates mutate it, and
    // restarting (aborting) the loop on every found cover would stall it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBooks, userId]);

  return progress;
}
