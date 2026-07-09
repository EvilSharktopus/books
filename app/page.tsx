"use client";

import { useState } from "react";
import RatingForm, { RatingValues } from "@/components/RatingForm";

export default function Home() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);

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

  return (
    <main className="min-h-screen bg-textured">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 py-4">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="text-xl font-bold text-white">
            Book
            <span className="text-indigo-300 ml-2">Ratings</span>
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
            Rate the books you&apos;ve read and share what you thought.
          </p>
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
      <footer className="mt-16 py-8 text-center border-t border-white/10">
        <p className="text-xs text-white/20">
          Every rating helps someone find their next great read.
        </p>
      </footer>
    </main>
  );
}
