"use client";

import { useState } from "react";
import RatingForm, { RatingValues } from "@/components/RatingForm";
import { useLocalStorage } from "@/components/useLocalStorage";

const BG_COLOR_KEY = "bookRatings.bgColor";

function isLightColor(hex: string): boolean {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export default function Home() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [storedBg, applyBgColor] = useLocalStorage(BG_COLOR_KEY);
  const bgColor =
    storedBg && /^#[0-9a-f]{6}$/i.test(storedBg) ? storedBg : null;

  async function handleSubmit(values: RatingValues) {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setError(null);
    setFormKey((k) => k + 1);
  }

  const light = bgColor !== null && isLightColor(bgColor);

  return (
    <main
      className={`min-h-screen ${bgColor ? "" : "bg-textured"}`}
      style={bgColor ? { background: bgColor } : undefined}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-sm border-b py-4 ${
          light ? "bg-white/20 border-black/10" : "bg-black/20 border-white/10"
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-start justify-between gap-4">
          <div>
            <h1
              className={`text-xl font-bold ${light ? "text-gray-900" : "text-white"}`}
            >
              Book
              <span className={light ? "text-indigo-700 ml-2" : "text-indigo-300 ml-2"}>
                Ratings
              </span>
            </h1>
            <p className={`text-sm mt-0.5 ${light ? "text-gray-600" : "text-white/50"}`}>
              Rate the books you&apos;ve read and share what you thought.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <label
              className={`flex items-center gap-2 cursor-pointer text-xs font-medium ${
                light ? "text-gray-700" : "text-white/60"
              } hover:opacity-80`}
              title="Customize background color"
            >
              <span
                className={`inline-block w-5 h-5 rounded-full border ${
                  light ? "border-black/20" : "border-white/40"
                }`}
                style={{
                  background:
                    bgColor ?? "linear-gradient(135deg, #312e81, #1e1b4b)",
                }}
              />
              Background
              <input
                type="color"
                value={bgColor ?? "#312e81"}
                onChange={(e) => applyBgColor(e.target.value)}
                className="absolute w-0 h-0 opacity-0"
                aria-label="Customize background color"
              />
            </label>
            {bgColor && (
              <button
                onClick={() => applyBgColor(null)}
                className={`text-xs underline underline-offset-2 ${
                  light ? "text-gray-600" : "text-white/50"
                } hover:opacity-80`}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center gap-4">
            <span className="text-4xl">✅</span>
            <h2 className="text-lg font-semibold text-gray-800">
              Thanks — your rating has been recorded!
            </h2>
            <button
              onClick={handleReset}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              Submit another rating
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
            <RatingForm key={formKey} onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        className={`mt-16 py-8 text-center border-t ${
          light ? "border-black/10" : "border-white/10"
        }`}
      >
        <p className={`text-xs ${light ? "text-gray-500/70" : "text-white/20"}`}>
          Every rating helps someone find their next great read.
        </p>
      </footer>
    </main>
  );
}
