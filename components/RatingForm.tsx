"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOOK_TYPES, RATING_SOURCES } from "@/lib/ratingSchema";
import { useBookSearch, BookResult } from "@/components/useBookSearch";
import { useLocalStorage } from "@/components/useLocalStorage";
import type { BookFields } from "@/lib/books";

const EMPTY_VALUES: BookFields = {
  title: "",
  authors: "",
  year: "",
  pages: "",
  cover: "",
  avgRating: null,
  source: "",
  myRating: 0,
  notes: "",
  cried: false,
  type: "",
  authorCountry: "",
  language: "English",
  originalLanguage: "",
  season: "",
  edition: "",
};

interface EditionOption {
  id: string;
  cover: string;
  label: string;
}

const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "None"];

const SOURCE_OPTIONS_KEY = "bookRatings.sourceOptions";
const LANGUAGE_OPTIONS_KEY = "bookRatings.languageOptions";
const DEFAULT_LANGUAGES = ["German"];

const INPUT_CLASSES =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400";

interface RatingFormProps {
  onSubmit: (values: BookFields) => void;
  isLoading: boolean;
  editMode?: boolean;
}

export default function RatingForm({ onSubmit, isLoading, editMode = false }: RatingFormProps) {
  const [values, setValues] = useState<BookFields>(EMPTY_VALUES);

  // Book search typeahead on the title field
  const [suppressSearch, setSuppressSearch] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { results, searching, failed } = useBookSearch(
    values.title,
    !suppressSearch
  );
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const dropdownOpen = results.length > 0 && !dismissed;

  // Editable "Where'd you hear about it?" options (persisted per browser)
  const [hiddenFields, setHiddenFields] = useLocalStorage("bookRatings.hiddenFields");
  const hiddenArr = useMemo<string[]>(() => {
    if (!hiddenFields) return [];
    try { return JSON.parse(hiddenFields); } catch { return []; }
  }, [hiddenFields]);
  const isHidden = (field: string) => hiddenArr.includes(field);
  const hideField = (field: string) => setHiddenFields(JSON.stringify([...hiddenArr, field]));
  const restoreFields = () => setHiddenFields("[]");

  // Original-language options for translated books (persisted per browser)
  const [storedLanguages, setStoredLanguages] = useLocalStorage(LANGUAGE_OPTIONS_KEY);
  const languageOptions = useMemo<string[]>(() => {
    if (storedLanguages) {
      try {
        const parsed: unknown = JSON.parse(storedLanguages);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((o) => typeof o === "string")) {
          return parsed;
        }
      } catch {
        // corrupted storage — fall through to defaults
      }
    }
    return [...DEFAULT_LANGUAGES];
  }, [storedLanguages]);
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");

  function addLanguage() {
    const lang = newLanguage.trim();
    if (!lang) return;
    if (!languageOptions.some((l) => l.toLowerCase() === lang.toLowerCase())) {
      setStoredLanguages(JSON.stringify([...languageOptions, lang]));
    }
    setValues((prev) => ({ ...prev, originalLanguage: lang }));
    setNewLanguage("");
    setAddingLanguage(false);
  }

  // Editable "Where'd you hear about it?" options (persisted per browser)
  const [storedOptions, setStoredOptions] = useLocalStorage(SOURCE_OPTIONS_KEY);
  const sourceOptions = useMemo<string[]>(() => {
    if (storedOptions) {
      try {
        const parsed: unknown = JSON.parse(storedOptions);
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((o) => typeof o === "string")
        ) {
          return parsed;
        }
      } catch {
        // corrupted storage — fall through to defaults
      }
    }
    return [...RATING_SOURCES];
  }, [storedOptions]);
  const [editingOptions, setEditingOptions] = useState(false);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function setField<K extends keyof BookFields>(
    field: K,
    value: BookFields[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  // Alternate editions of the picked book, so the reader can match the
  // cover art to the copy they actually read.
  const [editions, setEditions] = useState<EditionOption[]>([]);

  async function loadEditions(title: string, authors: string) {
    setEditions([]);
    try {
      const q = encodeURIComponent(`intitle:"${title}" ${authors}`.trim());
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20`
      );
      if (!res.ok) return;
      const data = await res.json();
      const seen = new Set<string>();
      const options: EditionOption[] = [];
      for (const item of data.items ?? []) {
        const v = item.volumeInfo ?? {};
        const cover = (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? "")
          .replace("http://", "https://");
        if (!cover || seen.has(cover)) continue;
        seen.add(cover);
        const label = [v.publisher, v.publishedDate?.slice(0, 4)]
          .filter(Boolean)
          .join(", ");
        options.push({ id: item.id, cover, label: label || "Unknown edition" });
        if (options.length >= 10) break;
      }
      if (options.length > 1) setEditions(options);
    } catch {
      // editions are a nice-to-have — fail silently
    }
  }

  function pickBook(book: BookResult) {
    setSuppressSearch(true);
    setValues((prev) => ({
      ...prev,
      title: book.title,
      authors: book.authors || prev.authors,
      year: book.year || prev.year,
      pages: book.pages || prev.pages,
      cover: book.cover,
      avgRating: book.avgRating,
      edition: "",
    }));
    setDismissed(true);
    setTimeout(() => setSuppressSearch(false), 400);
    loadEditions(book.title, book.authors);
  }

  function saveSourceOptions(options: string[]) {
    setStoredOptions(JSON.stringify(options));
  }

  function addOption() {
    const option = newOption.trim();
    if (!option || option.length > 100 || sourceOptions.includes(option)) {
      return;
    }
    saveSourceOptions([...sourceOptions, option]);
    setNewOption("");
  }

  function removeOption(option: string) {
    saveSourceOptions(sourceOptions.filter((o) => o !== option));
    if (values.source === option) setField("source", "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const canSubmit =
    values.title.trim() !== "" &&
    values.authors.trim() !== "" &&
    values.myRating >= 1;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div ref={searchWrapRef} className="relative flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-semibold text-gray-700">
          Title of the book <span className="text-red-500">*</span>
          {searching && (
            <span className="ml-2 font-normal text-xs text-gray-400">
              searching…
            </span>
          )}
        </label>
        <input
          id="title"
          type="text"
          value={values.title}
          onChange={(e) => {
            setField("title", e.target.value);
            setDismissed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDismissed(true);
          }}
          onFocus={() => setDismissed(false)}
          maxLength={200}
          autoComplete="off"
          placeholder="Start typing to search…"
          className={INPUT_CLASSES}
        />
        {dropdownOpen && (
          <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
            {results.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => pickBook(book)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                >
                  <span className="block text-sm font-medium text-gray-800 truncate">
                    {book.title}
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {book.authors}
                    {book.year && ` (${book.year})`}
                    {book.avgRating != null && ` · avg ★${(book.avgRating * 2).toFixed(1)}/10`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {failed && (
          <p className="text-xs text-gray-400 italic">
            Book search unavailable — enter the details manually.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="authors" className="text-sm font-semibold text-gray-700">
            Author(s) <span className="text-red-500">*</span>
          </label>
          <input
            id="authors"
            type="text"
            value={values.authors}
            onChange={(e) => setField("authors", e.target.value)}
            maxLength={200}
            placeholder="e.g. Nana Kwame Adjei-Brenyah"
            className={INPUT_CLASSES}
          />
        </div>

        {!isHidden("edition") && editions.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              Edition <span className="font-normal text-gray-500">(optional — pick the cover that matches your copy)</span>
              {editMode && <button type="button" onClick={() => hideField('edition')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
            </span>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {editions.map((ed) => {
                const selected = values.cover === ed.cover;
                return (
                  <button
                    key={ed.id}
                    type="button"
                    onClick={() => {
                      setField("cover", ed.cover);
                      setField("edition", ed.label === "Unknown edition" ? "" : ed.label);
                    }}
                    title={ed.label}
                    className={`shrink-0 rounded-lg border-2 p-1 transition-colors ${
                      selected ? "border-blue-600 bg-blue-50" : "border-transparent hover:border-blue-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ed.cover} alt={ed.label} className="w-14 h-[84px] object-cover rounded" />
                    <span className="block text-[10px] text-gray-500 max-w-14 truncate mt-0.5">{ed.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!isHidden("language") && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              Language <span className="font-normal text-gray-500">(optional)</span>
              {editMode && <button type="button" onClick={() => hideField('language')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
            </span>
            <div className="flex gap-2" role="radiogroup">
              {["English", "Translated"].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={values.language === lang}
                  onClick={() => {
                    setField("language", lang);
                    if (lang === "English") setField("originalLanguage", "");
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    values.language === lang
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            {values.language === "Translated" && (
              <div className="flex items-center gap-2 mt-1.5">
                <select
                  value={values.originalLanguage}
                  onChange={(e) => setField("originalLanguage", e.target.value)}
                  aria-label="Original language"
                  className={`${INPUT_CLASSES} flex-1 sm:max-w-xs`}
                >
                  <option value="">Original language…</option>
                  {languageOptions.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                {addingLanguage ? (
                  <>
                    <input
                      type="text"
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLanguage();
                        }
                      }}
                      maxLength={50}
                      placeholder="e.g. Japanese"
                      autoFocus
                      className={`${INPUT_CLASSES} w-32`}
                    />
                    <button
                      type="button"
                      onClick={addLanguage}
                      disabled={!newLanguage.trim()}
                      className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingLanguage(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap"
                  >
                    Add language
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!isHidden("authorCountry") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="authorCountry" className="text-sm font-semibold text-gray-700">
              Author country{" "}
              <span className="font-normal text-gray-500">(optional)</span>
              {editMode && <button type="button" onClick={() => hideField('authorCountry')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
            </label>
            <input
            id="authorCountry"
            type="text"
            value={values.authorCountry}
            onChange={(e) => setField("authorCountry", e.target.value)}
            maxLength={100}
            placeholder="e.g. Canada"
            className={INPUT_CLASSES}
          />
        </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        {!isHidden("year") && (
        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-sm font-semibold text-gray-700">
            Year <span className="font-normal text-gray-500">(optional)</span>
            {editMode && <button type="button" onClick={() => hideField('year')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
          </label>
          <input
            id="year"
            type="text"
            inputMode="numeric"
            value={values.year}
            onChange={(e) => setField("year", e.target.value)}
            maxLength={4}
            placeholder="e.g. 2023"
            className={INPUT_CLASSES}
          />
        </div>
        )}
        {!isHidden("pages") && (
        <div className="flex flex-col gap-1">
          <label htmlFor="pages" className="text-sm font-semibold text-gray-700">
            Pages <span className="font-normal text-gray-500">(optional)</span>
            {editMode && <button type="button" onClick={() => hideField('pages')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
          </label>
          <input
            id="pages"
            type="text"
            inputMode="numeric"
            value={values.pages}
            onChange={(e) => setField("pages", e.target.value)}
            maxLength={5}
            placeholder="e.g. 384"
            className={INPUT_CLASSES}
          />
        </div>
        )}
        {!isHidden("type") && (
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gray-700">
            Type <span className="font-normal text-gray-500">(optional)</span>
            {editMode && <button type="button" onClick={() => hideField('type')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
          </span>
          <div className="flex gap-2" role="radiogroup" aria-label="Type">
            {BOOK_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={values.type === type}
                onClick={() => setField("type", values.type === type ? "" : type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  values.type === type
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        )}

        {!isHidden("season") && (
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gray-700">
            Season <span className="font-normal text-gray-500">(optional)</span>
            {editMode && <button type="button" onClick={() => hideField('season')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Season">
            {SEASONS.map((season) => {
              const value = season === "None" ? "" : season;
              const selected = values.season === value;
              return (
                <button
                  key={season}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setField("season", value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                  }`}
                >
                  {season}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-gray-700">
          My rating <span className="text-red-500">*</span>{" "}
          <span className="font-normal text-gray-500">(1–10)</span>
          {values.avgRating != null && (
            <span className="ml-2 font-normal text-xs text-gray-400">
              public avg: ★{(values.avgRating * 2).toFixed(1)}/10
            </span>
          )}
        </span>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="radiogroup"
          aria-label="Rating out of 10"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={values.myRating === n}
              onClick={() => setField("myRating", n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                values.myRating === n
                  ? "bg-blue-600 border-blue-600 text-white"
                  : n <= values.myRating
                    ? "bg-blue-100 border-blue-200 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
              }`}
            >
              {n}
            </button>
          ))}
          {values.myRating > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              {values.myRating} / 10
            </span>
          )}
        </div>
      </div>

      {!isHidden("notes") && (
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-semibold text-gray-700">
          Notes <span className="font-normal text-gray-500">(optional)</span>
          {editMode && <button type="button" onClick={() => hideField('notes')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
        </label>
        <textarea
          id="notes"
          value={values.notes}
          onChange={(e) => setField("notes", e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="What did you think of it?"
          className={`${INPUT_CLASSES} resize-none`}
        />
      </div>
      )}

      {!isHidden("cried") && (
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">
        <input
          type="checkbox"
          checked={values.cried}
          onChange={(e) => setField("cried", e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        Cried while reading
        {editMode && <button type="button" onClick={() => hideField('cried')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
      </label>
      )}

      {!isHidden("source") && (
      <div className="flex flex-col gap-1">
        <label htmlFor="source" className="text-sm font-semibold text-gray-700">
          Where&apos;d you hear about it?{" "}
          <span className="font-normal text-gray-500">(optional)</span>
          {editMode && <button type="button" onClick={() => hideField('source')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">delete question</button>}
        </label>
        <div className="flex items-center gap-2">
          <select
            id="source"
            value={values.source}
            onChange={(e) => setField("source", e.target.value)}
            className={`${INPUT_CLASSES} flex-1 sm:max-w-xs`}
          >
            <option value="">Choose…</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditingOptions((e) => !e)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap"
          >
            {editingOptions ? "Done" : "Edit options"}
          </button>
        </div>
        {editingOptions && (
          <div className="mt-2 border border-gray-200 bg-gray-50 rounded-lg p-3 flex flex-col gap-2 sm:max-w-xs">
            {sourceOptions.map((option) => (
              <div
                key={option}
                className="flex items-center justify-between text-sm text-gray-700"
              >
                <span className="truncate">{option}</span>
                <button
                  type="button"
                  onClick={() => removeOption(option)}
                  aria-label={`Remove ${option}`}
                  className="text-gray-400 hover:text-red-500 text-base leading-none px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOption();
                  }
                }}
                maxLength={100}
                placeholder="New option"
                className={`${INPUT_CLASSES} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={addOption}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={!newOption.trim()}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {editMode && hiddenArr.length > 0 && (
        <div className="text-center pt-2">
          <button type="button" onClick={restoreFields} className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
            Restore hidden questions
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="w-full py-3 px-6 rounded-xl font-semibold text-white text-sm transition-all
          bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Submitting…
          </span>
        ) : (
          "Submit Rating"
        )}
      </button>
    </form>
  );
}
