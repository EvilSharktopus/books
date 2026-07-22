"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useBookSearch, BookResult } from "./useBookSearch";
import { KidsBookFields, KidsBookDoc } from "@/lib/kidsBooks";

export const ART_STYLES_CONFIG = [
  { key: "cartoony", label: "Cartoony & silly", example: "Cat Kid Comic Club" },
  { key: "real_life", label: "Looks like real life", example: "New Kid" },
  { key: "manga", label: "Manga style", example: "Hikaru in the Light!" },
  { key: "paint", label: "Soft & painty", example: "Séance Tea Party" },
  { key: "bw", label: "Just black & white", example: "Diary of a Wimpy Kid" },
  { key: "flat", label: "Simple shapes & flat colors", example: "Hilda" },
  { key: "other", label: "Other!", example: "" },
];

const INITIAL_FIELDS: KidsBookFields = {
  title: "",
  author: "",
  coverUrl: "",
  format: "Graphic Novel",
  rating: "loved",
  favoritePart: "",
  artStyle: "",
  artStyleOther: "",
  isSeries: false,
  seriesName: "",
  seriesBookNumber: undefined,
  seriesTotalBooks: undefined,
  willReadNext: "yes",
  favoriteInSeries: false,
};

interface MiaRatingFormProps {
  onSubmit: (fields: KidsBookFields) => void;
  isLoading: boolean;
  existingBooks: KidsBookDoc[];
  onCancel: () => void;
}

export default function MiaRatingForm({
  onSubmit,
  isLoading,
  existingBooks,
  onCancel,
}: MiaRatingFormProps) {
  const [values, setValues] = useState<KidsBookFields>({ ...INITIAL_FIELDS });
  const [suppressSearch, setSuppressSearch] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const { results, searching } = useBookSearch(values.title, !suppressSearch);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const dropdownOpen = results.length > 0 && !dismissed;

  // Auto-close search dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const setField = <K extends keyof KidsBookFields>(field: K, value: KidsBookFields[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const pickBook = (book: BookResult) => {
    setSuppressSearch(true);
    setValues((prev) => ({
      ...prev,
      title: book.title,
      author: book.authors || prev.author,
      coverUrl: book.cover || "",
    }));
    setDismissed(true);
    setTimeout(() => setSuppressSearch(false), 400);
  };

  // Get autocomplete suggestion list for series names
  const existingSeriesNames = useMemo(() => {
    const names = existingBooks
      .map((b) => b.seriesName?.trim())
      .filter((n): n is string => !!n);
    return Array.from(new Set(names));
  }, [existingBooks]);

  const [seriesSearchTerm, setSeriesSearchTerm] = useState("");
  const seriesDropdownOpen = useMemo(() => {
    if (!seriesSearchTerm) return false;
    const term = seriesSearchTerm.toLowerCase();
    return existingSeriesNames.some((name) => name.toLowerCase().includes(term) && name.toLowerCase() !== term);
  }, [seriesSearchTerm, existingSeriesNames]);

  const startDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try using Chrome or Safari!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };
    recognition.onerror = (e: any) => {
      console.error("Speech recognition error:", e);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setValues((prev) => ({
        ...prev,
        favoritePart: prev.favoritePart ? prev.favoritePart + " " + transcript : transcript,
      }));
    };
    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title.trim() || !values.author.trim()) {
      alert("Please enter both a Title and Author!");
      return;
    }
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-2xl mx-auto py-4">
      
      {/* CANCEL HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="comic-header-font text-3xl text-gray-800">Add a new book!</h2>
        <button
          type="button"
          onClick={onCancel}
          className="comic-btn-interactive px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white"
          style={{ "--comic-rotate": "-1deg" } as any}
        >
          Go Back
        </button>
      </div>

      {/* PANEL 1: Title & Author Search */}
      <div className="comic-panel flex flex-col gap-4" style={{ "--comic-rotate": "-0.5deg" } as any}>
        <div className="starburst starburst-gold absolute -top-4 -right-4 text-xs z-10">
          Book 1
        </div>
        <h3 className="comic-header-font text-xl mb-1">Which book did you read?</h3>
        
        <div ref={searchWrapRef} className="relative flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-800">Book Title</label>
          <input
            type="text"
            value={values.title}
            onChange={(e) => {
              setField("title", e.target.value);
              setDismissed(false);
            }}
            onFocus={() => setDismissed(false)}
            placeholder="Type book title to search..."
            className="border-3 border-gray-900 px-4 py-2 rounded text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 font-bold"
            required
          />
          {searching && <span className="text-xs text-gray-500 italic">Searching database...</span>}
          {dropdownOpen && (
            <ul className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border-3 border-gray-900 rounded shadow-lg max-h-60 overflow-y-auto">
              {results.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => pickBook(book)}
                    className="w-full text-left px-4 py-2 hover:bg-yellow-100 border-b-2 border-gray-900 flex gap-3 items-center"
                  >
                    {book.cover ? (
                      <img src={book.cover} alt="" className="w-8 h-10 object-cover border border-gray-900 rounded" />
                    ) : (
                      <div className="w-8 h-10 bg-gray-200 border border-gray-900 rounded flex items-center justify-center text-xs">📖</div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-gray-900">{book.title}</div>
                      <div className="text-xs text-gray-600">{book.authors}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-800">Author Name</label>
          <input
            type="text"
            value={values.author}
            onChange={(e) => setField("author", e.target.value)}
            placeholder="Who wrote it?"
            className="border-3 border-gray-900 px-4 py-2 rounded text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold"
            required
          />
        </div>

        {values.coverUrl && (
          <div className="mt-2 flex gap-3 items-center">
            <img
              src={values.coverUrl}
              alt="Preview"
              className="w-16 h-20 object-cover border-3 border-gray-900 rounded shadow-md transform rotate-2"
            />
            <span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-1 border-2 border-green-700 rounded">
              Cover Loaded!
            </span>
          </div>
        )}
      </div>

      {/* PANEL 2: Format */}
      <div className="comic-panel" style={{ "--comic-rotate": "0.6deg" } as any}>
        <div className="starburst starburst-gold absolute -top-4 -left-4 text-xs z-10">
          Book 2
        </div>
        <h3 className="comic-header-font text-xl mb-3">What kind of book is it?</h3>
        
        <div className="grid grid-cols-3 gap-3">
          {(["Graphic Novel", "Chapter Book", "Other"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setField("format", fmt)}
              className={`p-3 text-center rounded border-3 border-gray-900 font-bold text-sm shadow transition-all ${
                values.format === fmt
                  ? "bg-rose-500 text-white translate-y-0.5 shadow-none"
                  : "bg-white text-gray-800 hover:bg-rose-50"
              }`}
            >
              {fmt === "Graphic Novel" ? "🎨 Graphic Novel" : fmt === "Chapter Book" ? "📖 Chapter Book" : "✨ Something Else"}
            </button>
          ))}
        </div>
      </div>

      {/* PANEL 3: Series details */}
      <div className="comic-panel" style={{ "--comic-rotate": "-0.7deg" } as any}>
        <h3 className="comic-header-font text-xl mb-3">Is this book part of a series?</h3>

        <div className="flex gap-4 mb-4">
          <button
            type="button"
            onClick={() => setField("isSeries", true)}
            className={`flex-1 py-2 font-bold border-3 border-gray-900 rounded ${
              values.isSeries ? "bg-yellow-400 text-gray-900" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            YES!
          </button>
          <button
            type="button"
            onClick={() => {
              setField("isSeries", false);
              // Clear fields
              setField("seriesName", "");
              setField("seriesBookNumber", undefined);
              setField("seriesTotalBooks", undefined);
            }}
            className={`flex-1 py-2 font-bold border-3 border-gray-900 rounded ${
              !values.isSeries ? "bg-gray-400 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            NOPE
          </button>
        </div>

        {values.isSeries && (
          <div className="flex flex-col gap-4 pt-2 border-t-2 border-dashed border-gray-400">
            <div className="relative flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-800">Series Name</label>
              <input
                type="text"
                value={values.seriesName || ""}
                onChange={(e) => {
                  setField("seriesName", e.target.value);
                  setSeriesSearchTerm(e.target.value);
                }}
                placeholder="e.g. Cat Kid Comic Club"
                className="border-3 border-gray-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold"
              />
              {seriesDropdownOpen && (
                <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border-3 border-gray-900 rounded shadow-lg max-h-40 overflow-y-auto">
                  {existingSeriesNames
                    .filter((n) => n.toLowerCase().includes(seriesSearchTerm.toLowerCase()))
                    .map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => {
                            setField("seriesName", name);
                            setSeriesSearchTerm("");
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-yellow-100 border-b-2 border-gray-900 font-bold"
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-800">Book Number</label>
                <input
                  type="number"
                  min="1"
                  value={values.seriesBookNumber || ""}
                  onChange={(e) => setField("seriesBookNumber", parseInt(e.target.value) || undefined)}
                  placeholder="e.g. 1"
                  className="border-3 border-gray-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-800">Total Books in Series</label>
                <input
                  type="number"
                  min="1"
                  value={values.seriesTotalBooks || ""}
                  onChange={(e) => setField("seriesTotalBooks", parseInt(e.target.value) || undefined)}
                  placeholder="e.g. 5 (optional)"
                  className="border-3 border-gray-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm font-bold text-gray-800">Will you read the next one?</label>
              <div className="grid grid-cols-3 gap-2">
                {(["yes", "not_sure", "no"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField("willReadNext", opt)}
                    className={`py-2 text-center rounded border-2 border-gray-900 font-bold text-xs ${
                      values.willReadNext === opt ? "bg-yellow-400 text-gray-900" : "bg-white text-gray-700"
                    }`}
                  >
                    {opt === "yes" ? "👍 YES!" : opt === "not_sure" ? "🤔 NOT SURE" : "👎 NO"}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 mt-2 cursor-pointer font-bold select-none">
              <input
                type="checkbox"
                checked={values.favoriteInSeries || false}
                onChange={(e) => setField("favoriteInSeries", e.target.checked)}
                className="w-5 h-5 border-3 border-gray-900 rounded accent-rose-500"
              />
              🏆 Is this your FAVORITE book in the series?
            </label>
          </div>
        )}
      </div>

      {/* PANEL 4: Art Style (Only pops up if Graphic Novel, optional) */}
      {values.format === "Graphic Novel" && (
        <div className="comic-panel" style={{ "--comic-rotate": "0.5deg" } as any}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="comic-header-font text-xl">How does the art look?</h3>
            <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs font-bold text-rose-600 underline hover:text-rose-800"
            >
              Need examples?
            </button>
          </div>

          {/* Configuration-driven examples panel */}
          {showExamples && (
            <div className="speech-bubble text-sm text-gray-800 mb-4 animate-fade-in bg-yellow-50 border-yellow-500">
              <p className="font-bold mb-2 text-yellow-800">Check these out for ideas:</p>
              <ul className="list-disc pl-5 flex flex-col gap-1">
                {ART_STYLES_CONFIG.filter((s) => s.example).map((style) => (
                  <li key={style.key}>
                    <span className="font-bold">{style.label}:</span> e.g. <span className="italic">{style.example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ART_STYLES_CONFIG.map((style) => (
              <button
                key={style.key}
                type="button"
                onClick={() => {
                  setField("artStyle", style.key);
                  if (style.key !== "other") {
                    setField("artStyleOther", "");
                  }
                }}
                className={`p-2 rounded border-2 border-gray-900 font-bold text-xs transition-all ${
                  values.artStyle === style.key ? "bg-rose-500 text-white" : "bg-white text-gray-700 hover:bg-rose-50"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {values.artStyle === "other" && (
            <div className="flex flex-col gap-2 mt-4 animate-slide-down">
              <label className="text-sm font-bold text-gray-800">Describe the art style:</label>
              <input
                type="text"
                value={values.artStyleOther || ""}
                onChange={(e) => setField("artStyleOther", e.target.value)}
                placeholder="e.g. Neon colors, cute stickers, glowy..."
                className="border-3 border-gray-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 font-semibold"
              />
            </div>
          )}
        </div>
      )}

      {/* PANEL 5: Rating */}
      <div className="comic-panel" style={{ "--comic-rotate": "-0.4deg" } as any}>
        <div className="starburst starburst-gold absolute -top-4 -right-4 text-xs z-10">
          Book 5
        </div>
        <h3 className="comic-header-font text-xl mb-3">How much did you like it?</h3>

        <div className="grid grid-cols-4 gap-2.5">
          {(["loved", "liked", "okay", "not_for_me"] as const).map((r) => {
            const labelMap = {
              loved: "😍😍 Loved it!",
              liked: "🙂🙂 Liked it!",
              okay: "😐😐 Okay",
              not_for_me: "👎👎 Not for me",
            };
            const colorMap = {
              loved: "bg-red-500",
              liked: "bg-orange-400",
              okay: "bg-yellow-300",
              not_for_me: "bg-gray-400",
            };
            const isSelected = values.rating === r;

            return (
              <button
                key={r}
                type="button"
                onClick={() => setField("rating", r)}
                className={`p-3 rounded border-3 border-gray-900 font-bold text-xs sm:text-sm text-center shadow transition-all ${
                  isSelected
                    ? `${colorMap[r]} text-gray-900 translate-y-0.5 shadow-none`
                    : "bg-white text-gray-800 hover:bg-gray-100"
                }`}
              >
                {labelMap[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* PANEL 6: Favorite Part */}
      <div className="comic-panel" style={{ "--comic-rotate": "0.8deg" } as any}>
        <div className="flex justify-between items-center mb-2">
          <label className="comic-header-font text-xl">What was your favorite part?</label>
          <button
            type="button"
            onClick={startDictation}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-gray-900 text-xs font-bold transition-colors ${
              isListening ? "bg-red-500 text-white animate-pulse" : "bg-white hover:bg-gray-100 text-gray-800"
            }`}
          >
            {isListening ? (
              <>
                <span className="listening-indicator"></span> Listening...
              </>
            ) : (
              <>🎤 Speak it!</>
            )}
          </button>
        </div>
        <textarea
          value={values.favoritePart || ""}
          onChange={(e) => setField("favoritePart", e.target.value)}
          placeholder="e.g. When the cat built an entire sandwich tower!"
          rows={3}
          className="w-full border-3 border-gray-900 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 font-medium"
        />
      </div>

      {/* SAVE BUTTON */}
      <div className="text-center mt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="comic-btn-interactive px-12 py-5 text-2xl bg-yellow-400 hover:bg-yellow-500 text-gray-900 transform scale-105 active:scale-100 hover:rotate-1"
          style={{ "--comic-rotate": "-2deg" } as any}
        >
          {isLoading ? "💥 CRASH! Saving..." : "💥 BAM! Save it!"}
        </button>
      </div>

    </form>
  );
}
