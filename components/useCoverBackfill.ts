"use client";

import { useEffect, useRef, useState } from "react";
import { BookDoc, updateBook } from "@/lib/books";
import { authorsOverlap, plausiblePages } from "@/lib/bookMatch";
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
const DETAILS_MISS_KEY = "bookRatings.detailsMisses.v1"; // pages + year

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
  year: string; // first publication year where known, else ""
}

/** A plausible publication year, or "" (indexes contain junk like 0 or 9999). */
function cleanYear(y: number | string | undefined | null): string {
  const n = typeof y === "string" ? parseInt(y.slice(0, 4), 10) : (y ?? NaN);
  return n >= 1000 && n <= new Date().getFullYear() + 1 ? String(n) : "";
}

export interface FilledFields {
  cover?: string;
  avgRating?: number;
  pages?: string;
  year?: string;
}

// Thrown when the API request itself failed (rate limit, network) — the
// book must NOT be marked as a permanent miss in that case.
class LookupFailed extends Error {}

// Drop subtitles/parentheticals that spoil exact matching,
// e.g. "An american marriage: a novel" or "Slumdog Millionaire (Q&A)".
function cleanTitle(title: string): string {
  return title.split(/[:(]|\s-\s/)[0].replace(/\s+/g, " ").trim();
}

// `authors` is the book's own author string, used to decide whether the
// match is trustworthy enough to take its page count and year from (covers
// keep the looser behaviour they've always had).
async function googleLookup(
  q: string,
  signal: AbortSignal,
  authors = ""
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
  const trusted = authorsOverlap(authors, v.authors);
  return {
    pages: trusted ? plausiblePages(v.pageCount) : "",
    // Google's date is the edition's, so it's only a fallback for year.
    year: trusted ? cleanYear(v.publishedDate) : "",
    cover: storableCover(
      v.imageLinks.thumbnail ?? v.imageLinks.smallThumbnail ?? ""
    ),
    avgRating: v.averageRating ?? null,
  };
}

async function openLibraryLookup(
  title: string,
  author: string,
  signal: AbortSignal,
  bookAuthors = author
): Promise<CoverHit | null> {
  const params = new URLSearchParams({
    title,
    limit: "20",
    fields: "cover_i,ratings_average,number_of_pages_median,first_publish_year,author_name",
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
    first_publish_year?: number;
    author_name?: string[];
  }[] = data.docs ?? [];
  const doc = docs.find((d) => d.cover_i);
  if (!doc) return null;
  // Details only from records by the same author: a title-only search can
  // land on a different book ("The Young Man" from 1818 vs Ernaux's).
  const same = docs.filter((d) => authorsOverlap(bookAuthors, d.author_name));
  const detailDoc = same.includes(doc) ? doc : same[0];
  const pages =
    plausiblePages(detailDoc?.number_of_pages_median) ||
    plausiblePages(same.find((d) => plausiblePages(d.number_of_pages_median))?.number_of_pages_median);
  return {
    pages,
    year: cleanYear(detailDoc?.first_publish_year),
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
    () => googleLookup(`intitle:"${title}" ${authors}`.trim(), signal, authors),
    () => openLibraryLookup(title, authors, signal),
    () => openLibraryLookup(title, "", signal, authors),
    ...(ampSwapped ? [() => openLibraryLookup(ampSwapped, "", signal, authors)] : []),
    ...(clean !== title
      ? [() => openLibraryLookup(clean, "", signal, authors)]
      : []),
    () => googleLookup(`${clean} ${authors}`.trim(), signal, authors),
    () => googleLookup(clean, signal, authors),
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

interface Details {
  pages: string;
  year: string;
}

// Page count and first-publication year (the book already has a cover).
// Open Library first: it has no daily quota and its year is the original
// publication rather than an edition's. Google Books fills remaining gaps.
// Same null/throw contract as findCover.
async function findDetails(
  title: string,
  authors: string,
  signal: AbortSignal
): Promise<Details | null> {
  const clean = cleanTitle(title);
  const attempts: (() => Promise<Details | null>)[] = [
    () => openLibraryDetails(title, authors, signal, authors),
    () => openLibraryDetails(clean, "", signal, authors),
    () => googleLookup(`intitle:"${clean}" ${authors}`.trim(), signal, authors),
  ];
  const found: Details = { pages: "", year: "" };
  let anySucceeded = false;
  for (const attempt of attempts) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const hit = await attempt();
      anySucceeded = true;
      if (hit) {
        found.pages ||= hit.pages;
        found.year ||= hit.year;
      }
      if (found.pages && found.year) break;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!anySucceeded) throw new LookupFailed("all sources failed");
  return found.pages || found.year ? found : null;
}

async function openLibraryDetails(
  title: string,
  author: string,
  signal: AbortSignal,
  bookAuthors: string
): Promise<Details | null> {
  const params = new URLSearchParams({
    title,
    limit: "10",
    fields: "number_of_pages_median,first_publish_year,author_name",
  });
  if (author) params.set("author", author);
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal,
  });
  if (!res.ok) throw new LookupFailed(`openlibrary ${res.status}`);
  const data = await res.json();
  const docs: {
    number_of_pages_median?: number;
    first_publish_year?: number;
    author_name?: string[];
  }[] = data.docs ?? [];
  // Only records by the same author count (see openLibraryLookup).
  const same = docs.filter((d) => authorsOverlap(bookAuthors, d.author_name));
  if (same.length === 0) return null;
  return {
    pages:
      plausiblePages(same.find((d) => plausiblePages(d.number_of_pages_median))?.number_of_pages_median),
    // The best match's year, not any match's: later docs are often other books.
    year: cleanYear(same[0].first_publish_year),
  };
}

// Quietly fills in missing covers, page counts and publication years while
// the list is open:
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
    const detailMisses = loadMisses(DETAILS_MISS_KEY);
    const needsCover = (b: BookDoc) => !b.cover && !coverMisses.has(b.id);
    // Implausible stored page counts (e.g. "10") count as missing so they get replaced.
    const needsDetails = (b: BookDoc) =>
      (!plausiblePages(b.pages) || !b.year) && !b.favoriteOnly && !detailMisses.has(b.id);
    // Newest first, so this year's books (the ones Wrapped counts) are
    // filled before the long tail of imported backlog entries.
    const queue = snapshot
      .filter((b) => b.title && (needsCover(b) || needsDetails(b)))
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
              if (hit.pages && !plausiblePages(book.pages)) fields.pages = hit.pages;
              if (hit.year && !book.year) fields.year = hit.year;
            } else {
              // Searches ran and found nothing — a real miss, don't retry.
              saveMiss(MISS_KEY, book.id);
            }
          }
          const wantPages = !plausiblePages(book.pages) && !fields.pages;
          const wantYear = !book.year && !fields.year;
          if (needsDetails(book) && (wantPages || wantYear)) {
            const found = await findDetails(book.title, book.authors, controller.signal);
            if (wantPages && found?.pages) fields.pages = found.pages;
            if (wantYear && found?.year) fields.year = found.year;
            // The searches ran; whatever is still missing isn't out there.
            if ((wantPages && !fields.pages) || (wantYear && !fields.year))
              saveMiss(DETAILS_MISS_KEY, book.id);
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
