"use client";

import { useEffect, useRef, useState } from "react";

export interface BookResult {
  id: string;
  title: string;
  authors: string;
  year: string;
  source: string;
}

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
  };
}

interface OpenLibraryDoc {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
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
        source: "Google Books",
      }));
    }
    throw new Error("google-empty");
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=6&fields=key,title,author_name,first_publish_year`,
      { signal }
    );
    if (!res.ok) throw new Error("both-failed");
    const data: { docs?: OpenLibraryDoc[] } = await res.json();
    return (data.docs ?? []).map((d) => ({
      id: d.key,
      title: d.title ?? "",
      authors: d.author_name?.join(", ") ?? "",
      year: d.first_publish_year ? String(d.first_publish_year) : "",
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
