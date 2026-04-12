"use client";

import { useState } from "react";
import UploadForm, { FormValues } from "@/components/UploadForm";
import QuestionOutput from "@/components/QuestionOutput";

export default function Home() {
  const [questions, setQuestions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("course", values.course);
      formData.append("questionCount", String(values.questionCount));
      formData.append("guidance", values.guidance);

      const labels = ["A", "B", "C"] as const;
      values.sources.forEach((file, i) => {
        formData.append(`source${labels[i]}`, file);
      });

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setQuestions(data.questions);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setQuestions(null);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-white">
            Alberta Social Studies
            <span className="text-indigo-300 ml-2">Question Generator</span>
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
            Upload a source, choose your course, and generate curriculum-aligned exam questions.
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Rate limit notice */}
        <div className="mb-6 text-xs text-indigo-200/60 bg-white/10 rounded-lg px-4 py-2 text-center">
          Free to use · 5 question sets per day per user · Powered by Claude AI
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {questions ? (
          <QuestionOutput markdown={questions} onReset={handleReset} />
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6">
            <UploadForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 py-6 text-center text-xs text-white/30 border-t border-white/10">
        Built for Alberta teachers · Questions aligned to Alberta Education Program of Studies
      </footer>
    </main>
  );
}
