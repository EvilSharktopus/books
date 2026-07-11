"use client";

import { useEffect, useRef, useState } from "react";
import { BookDoc, updateBook } from "@/lib/books";

export interface BackfillProgress {
  total: number;
  done: number;
  found: number;
  finished: boolean;
  lastError: string | null;
}

// Book ids we already tried and found nothing for, so page reloads don't
// re-query the same misses forever (persisted per browser).
const MISS_KEY = "bookRatings.coverMisses.v6";

function loadMisses(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MISS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveMiss(id: string) {
  const misses = loadMisses();
  misses.add(id);
  localStorage.setItem(MISS_KEY, JSON.stringify([...misses]));
}

interface CoverHit {
  cover: string;
  avgRating: number | null;
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
    cover: (v.imageLinks.thumbnail ?? v.imageLinks.smallThumbnail ?? "")
      .replace("http://", "https://"),
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
    fields: "cover_i,ratings_average",
  });
  if (author) params.set("author", author);
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal,
  });
  if (!res.ok) throw new LookupFailed(`openlibrary ${res.status}`);
  const data = await res.json();
  const doc = (data.docs ?? []).find((d: { cover_i?: number }) => d.cover_i);
  if (!doc) return null;
  return {
    cover: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
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

// Quietly fills in missing covers while the list is open: one lookup at a
// time, saved to Firestore and reflected in the list as they land.
export function useCoverBackfill(
  userId: string,
  books: BookDoc[] | null,
  onCoverFound: (bookId: string, cover: string, avgRating: number | null) => void
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
    const misses = loadMisses();
    const queue = snapshot.filter((b) => !b.cover && b.title && !misses.has(b.id));
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
          const hit = await findCover(book.title, book.authors, controller.signal);
          if (controller.signal.aborted) return;
          if (hit?.cover) {
            const fields: { cover: string; avgRating?: number } = { cover: hit.cover };
            if (hit.avgRating != null && book.avgRating == null)
              fields.avgRating = hit.avgRating;
            await updateBook(userId, book.id, fields);
            onCoverFound(book.id, hit.cover, fields.avgRating ?? null);
            state.found++;
          } else {
            // Searches ran and found nothing — a real miss, don't retry.
            saveMiss(book.id);
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
