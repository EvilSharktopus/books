"use client";

import { useState } from "react";

export interface RatingValues {
  bookTitle: string;
  author: string;
  authorCountry: string;
  rating: number;
  comments: string;
}

const EMPTY_VALUES: RatingValues = {
  bookTitle: "",
  author: "",
  authorCountry: "",
  rating: 0,
  comments: "",
};

const INPUT_CLASSES =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400";

interface RatingFormProps {
  onSubmit: (values: RatingValues) => void;
  isLoading: boolean;
}

export default function RatingForm({ onSubmit, isLoading }: RatingFormProps) {
  const [values, setValues] = useState<RatingValues>(EMPTY_VALUES);

  function setField<K extends keyof RatingValues>(
    field: K,
    value: RatingValues[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const canSubmit =
    values.bookTitle.trim() !== "" &&
    values.author.trim() !== "" &&
    values.rating >= 1;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="bookTitle" className="text-sm font-semibold text-gray-700">
          Book title <span className="text-red-500">*</span>
        </label>
        <input
          id="bookTitle"
          type="text"
          value={values.bookTitle}
          onChange={(e) => setField("bookTitle", e.target.value)}
          maxLength={200}
          placeholder="e.g. The Remains of the Day"
          className={INPUT_CLASSES}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="author" className="text-sm font-semibold text-gray-700">
            Author <span className="text-red-500">*</span>
          </label>
          <input
            id="author"
            type="text"
            value={values.author}
            onChange={(e) => setField("author", e.target.value)}
            maxLength={200}
            placeholder="e.g. Kazuo Ishiguro"
            className={INPUT_CLASSES}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="authorCountry" className="text-sm font-semibold text-gray-700">
            Author country{" "}
            <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="authorCountry"
            type="text"
            value={values.authorCountry}
            onChange={(e) => setField("authorCountry", e.target.value)}
            maxLength={100}
            placeholder="e.g. United Kingdom"
            className={INPUT_CLASSES}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-gray-700">
          Overall rating <span className="text-red-500">*</span>
        </span>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Overall rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={values.rating === star}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              onClick={() => setField("rating", star)}
              className={`text-3xl leading-none transition-colors ${
                star <= values.rating
                  ? "text-amber-400"
                  : "text-gray-300 hover:text-amber-200"
              }`}
            >
              ★
            </button>
          ))}
          {values.rating > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              {values.rating} / 5
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="comments" className="text-sm font-semibold text-gray-700">
          Comments <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="comments"
          value={values.comments}
          onChange={(e) => setField("comments", e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="What did you think of it?"
          className={`${INPUT_CLASSES} resize-none`}
        />
      </div>

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
