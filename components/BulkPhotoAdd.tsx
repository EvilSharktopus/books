"use client";

import { useEffect, useRef, useState } from "react";
import { searchBooks } from "@/components/useBookSearch";
import { addBook } from "@/lib/books";
import type { AppUser, BookFields } from "@/lib/books";

interface Candidate {
  key: string;
  include: boolean;
  title: string;
  authors: string;
  year: string;
  pages: string;
  cover: string;
  avgRating: number | null;
  enriching: boolean;
  saved: boolean;
  saveError: string | null;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_PHOTOS = 6;

const INPUT_CLASSES =
  "border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400";

interface BulkPhotoAddProps {
  user: AppUser;
  onDone: () => void;
}

export default function BulkPhotoAdd({ user, onDone }: BulkPhotoAddProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const previewsRef = useRef<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    previewsRef.current = urls;
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function enrichCandidate(key: string, title: string, authors: string) {
    const controller = new AbortController();
    searchBooks(`${title} ${authors}`.trim(), controller.signal)
      .then((results) => {
        const match = results[0];
        if (!match) return;
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === key
              ? {
                  ...c,
                  authors: c.authors || match.authors,
                  year: match.year,
                  pages: match.pages,
                  cover: match.cover,
                  avgRating: match.avgRating,
                }
              : c
          )
        );
      })
      .catch(() => {
        // enrichment is a nice-to-have — fail silently
      })
      .finally(() => {
        setCandidates((prev) =>
          prev.map((c) => (c.key === key ? { ...c, enriching: false } : c))
        );
      });
  }

  async function scanPhotos() {
    if (photos.length === 0) return;
    setScanning(true);
    setScanError(null);
    try {
      const formData = new FormData();
      photos.forEach((file) => formData.append("photos", file));
      const res = await fetch("/api/extract-books", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const books: { title: string; author: string }[] = data.books ?? [];
      if (books.length === 0) {
        setScanError("No books were recognized in these photos. Try clearer or closer photos.");
        return;
      }
      const next: Candidate[] = books.map((b) => ({
        key: `${b.title}|${b.author}|${Math.random().toString(36).slice(2)}`,
        include: true,
        title: b.title,
        authors: b.author,
        year: "",
        pages: "",
        cover: "",
        avgRating: null,
        enriching: true,
        saved: false,
        saveError: null,
      }));
      setCandidates(next);
      next.forEach((c) => enrichCandidate(c.key, c.title, c.authors));
    } catch {
      setScanError("Network error. Please check your connection and try again.");
    } finally {
      setScanning(false);
    }
  }

  function updateCandidate<K extends keyof Candidate>(key: string, field: K, value: Candidate[K]) {
    setCandidates((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  function removeCandidate(key: string) {
    setCandidates((prev) => prev.filter((c) => c.key !== key));
  }

  const includedCount = candidates.filter((c) => c.include && !c.saved).length;

  async function submitAll() {
    setValidationError(null);
    const pending = candidates.filter((c) => c.include && !c.saved);
    if (pending.length === 0) return;

    const invalid = pending.some((c) => !c.title.trim());
    if (invalid) {
      setValidationError("Give each included book a title before adding.");
      return;
    }

    setSubmitting(true);
    for (const candidate of pending) {
      const fields: BookFields = {
        title: candidate.title.trim(),
        authors: candidate.authors.trim(),
        year: candidate.year,
        pages: candidate.pages,
        cover: candidate.cover,
        avgRating: candidate.avgRating,
        source: "",
        myRating: 0,
        notes: "",
        cried: false,
        type: "",
        authorCountry: "",
        authorGender: "",
        language: "English",
        originalLanguage: "",
        season: "",
        edition: "",
        favorite: false,
        favoriteOnly: false,
      };
      try {
        await addBook(user.id, fields);
        setCandidates((prev) =>
          prev.map((c) => (c.key === candidate.key ? { ...c, saved: true, saveError: null } : c))
        );
      } catch (err) {
        console.error("[bulk-photo-add] Failed to save book:", err);
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? { ...c, saveError: err instanceof Error ? err.message : "Failed to save." }
              : c
          )
        );
      }
    }
    setSubmitting(false);
  }

  const allSaved = candidates.length > 0 && candidates.every((c) => c.saved || !c.include);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Add books from a photo</h2>
        <p className="text-sm text-gray-500">
          Upload photos of a shelf, stack, or covers (up to {MAX_PHOTOS}) — we&apos;ll pick out the
          titles. Uncheck anything that&apos;s wrong, then add them all — no rating needed now,
          you can rate them anytime from the list view.
        </p>
      </div>

      {candidates.length === 0 && (
        <>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label="Remove photo"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-500 text-xs leading-none flex items-center justify-center shadow"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <div
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer w-20 h-20 border-2 border-dashed border-gray-300 hover:border-blue-300 hover:bg-gray-50 rounded-lg flex items-center justify-center text-2xl text-gray-400 select-none"
              >
                +
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              multiple
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {scanError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {scanError}
            </div>
          )}

          <button
            type="button"
            onClick={scanPhotos}
            disabled={photos.length === 0 || scanning}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white text-sm transition-all
              bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning photos…
              </span>
            ) : (
              "Scan photos for books"
            )}
          </button>
        </>
      )}

      {candidates.length > 0 && !allSaved && (
        <div className="flex flex-col gap-4">
          {candidates.map((c) => (
            <div
              key={c.key}
              className={`flex gap-3 border rounded-xl p-3 ${
                c.saved ? "border-green-200 bg-green-50" : "border-gray-200"
              }`}
            >
              <label className="flex items-center pt-1">
                <input
                  type="checkbox"
                  checked={c.include}
                  disabled={c.saved}
                  onChange={(e) => updateCandidate(c.key, "include", e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <div className="w-12 h-[72px] shrink-0 rounded bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                {c.enriching ? (
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                ) : c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg text-gray-300">📕</span>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={c.title}
                    disabled={c.saved}
                    onChange={(e) => updateCandidate(c.key, "title", e.target.value)}
                    placeholder="Title"
                    className={INPUT_CLASSES}
                  />
                  <input
                    type="text"
                    value={c.authors}
                    disabled={c.saved}
                    onChange={(e) => updateCandidate(c.key, "authors", e.target.value)}
                    placeholder="Author(s)"
                    className={INPUT_CLASSES}
                  />
                </div>
                {c.saved && <span className="text-xs font-medium text-green-700">Added ✓</span>}
                {c.saveError && <span className="text-xs text-red-600">{c.saveError}</span>}
              </div>

              {!c.saved && (
                <button
                  type="button"
                  onClick={() => removeCandidate(c.key)}
                  aria-label="Remove book"
                  className="text-gray-400 hover:text-red-500 text-lg leading-none px-1 self-start"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {validationError}
            </div>
          )}

          <button
            type="button"
            onClick={submitAll}
            disabled={submitting || includedCount === 0}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white text-sm transition-all
              bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Adding…"
              : includedCount > 0
                ? `Add ${includedCount} book${includedCount === 1 ? "" : "s"}`
                : "Nothing to add"}
          </button>
        </div>
      )}

      {allSaved && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="text-4xl">✅</span>
          <h3 className="text-lg font-semibold text-gray-800">
            {candidates.filter((c) => c.saved).length} book
            {candidates.filter((c) => c.saved).length === 1 ? "" : "s"} added!
          </h3>
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
