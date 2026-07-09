"use client";

import { useEffect, useRef, useState } from "react";

export interface BookResult {
  id: string;
  title: string;
  authors: string;
  year: string;
  pages: string;
  cover: string;
  avgRating: number | null;
  source: string;
}

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: { smallThumbnail?: string };
    averageRating?: number;
  };
}

interface OpenLibraryDoc {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  ratings_average?: number;
}

// Google Books primary, Open Library fallback.
async function searchBooks(
  query: string,
  signal: AbortSignal
): Promise<BookResult[]> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6`,
      { signal }
    );
    if (!res.ok) throw new Error("google-fail");
    const data: { items?: GoogleVolume[] } = await res.json();
    if (data.items?.length) {
      return data.items.map((b) => ({
        id: b.id,
        title: b.volumeInfo?.title ?? "",
        authors: b.volumeInfo?.authors?.join(", ") ?? "",
        year: b.volumeInfo?.publishedDate?.slice(0, 4) ?? "",
        pages: b.volumeInfo?.pageCount ? String(b.volumeInfo.pageCount) : "",
        cover:
          b.volumeInfo?.imageLinks?.smallThumbnail?.replace(
            "http://",
            "https://"
          ) ?? "",
        avgRating: b.volumeInfo?.averageRating ?? null,
        source: "Google Books",
      }));
    }
    throw new Error("google-empty");
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=6&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,ratings_average`,
      { signal }
    );
    if (!res.ok) throw new Error("both-failed");
    const data: { docs?: OpenLibraryDoc[] } = await res.json();
    return (data.docs ?? []).map((d) => ({
      id: d.key,
      title: d.title ?? "",
      authors: d.author_name?.join(", ") ?? "",
      year: d.first_publish_year ? String(d.first_publish_year) : "",
      pages: d.number_of_pages_median ? String(d.number_of_pages_median) : "",
      cover: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg`
        : "",
      avgRating: d.ratings_average
        ? Math.round(d.ratings_average * 10) / 10
        : null,
      source: "Open Library",
    }));
  }
}

// Debounced typeahead. Pass enabled=false to pause (e.g. right after
// picking a result, so the programmatic title change doesn't re-search).
export function useBookSearch(query: string, enabled = true) {
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setFailed(false);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const found = await searchBooks(q, controller.signal);
        setResults(found);
        setFailed(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          // Fail silently into manual mode — the form still works
          setResults([]);
          setFailed(true);
        }
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, enabled]);

  return { results, searching, failed };
}
