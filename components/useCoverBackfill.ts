"use client";

import { useEffect, useRef } from "react";
import { BookDoc, updateBook } from "@/lib/books";

// Book ids we already tried and found nothing for, so page reloads don't
// re-query the same misses forever (persisted per browser).
const MISS_KEY = "bookRatings.coverMisses";

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

async function findCover(
  title: string,
  authors: string,
  signal: AbortSignal
): Promise<CoverHit | null> {
  const q = encodeURIComponent(`intitle:"${title}" ${authors}`.trim());
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`,
      { signal }
    );
    if (res.ok) {
      const data = await res.json();
      const item = (data.items ?? []).find(
        (i: { volumeInfo?: { imageLinks?: object } }) => i.volumeInfo?.imageLinks
      );
      if (item) {
        const v = item.volumeInfo;
        return {
          cover: (v.imageLinks.thumbnail ?? v.imageLinks.smallThumbnail ?? "")
            .replace("http://", "https://"),
          avgRating: v.averageRating ?? null,
        };
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }
  try {
    const params = new URLSearchParams({
      title,
      limit: "3",
      fields: "cover_i,ratings_average",
    });
    if (authors) params.set("author", authors);
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = (data.docs ?? []).find(
      (d: { cover_i?: number }) => d.cover_i
    );
    if (!doc) return null;
    return {
      cover: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
      avgRating: doc.ratings_average
        ? Math.round(doc.ratings_average * 10) / 10
        : null,
    };
  } catch {
    return null;
  }
}

// Quietly fills in missing covers while the list is open: one lookup at a
// time, saved to Firestore and reflected in the list as they land.
export function useCoverBackfill(
  userId: string,
  books: BookDoc[] | null,
  onCoverFound: (bookId: string, cover: string, avgRating: number | null) => void
) {
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
          } else {
            saveMiss(book.id);
          }
        } catch {
          return; // aborted or offline — stop quietly, next visit resumes
        }
        await new Promise((r) => setTimeout(r, 700));
        if (controller.signal.aborted) return;
      }
    })().finally(() => {
      running.current = false;
    });

    return () => controller.abort();
    // Deliberately not keyed on `books` — cover updates mutate it, and
    // restarting (aborting) the loop on every found cover would stall it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBooks, userId]);
}
