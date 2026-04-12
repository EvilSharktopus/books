"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

export type FormValues = {
  sources: File[];
  course: string;
  questionCount: number;
  guidance: string;
};

type SourceSlot = {
  label: "A" | "B" | "C";
  file: File | null;
};

type Props = {
  onSubmit: (values: FormValues) => void;
  isLoading: boolean;
};

const COURSES = [
  { value: "30-1", label: "Social Studies 30-1" },
  { value: "30-2", label: "Social Studies 30-2" },
  { value: "20-1", label: "Social Studies 20-1" },
  { value: "20-2", label: "Social Studies 20-2" },
  { value: "10-1", label: "Social Studies 10-1" },
  { value: "10-2", label: "Social Studies 10-2" },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

function SourceDropZone({
  slot,
  onFile,
  onRemove,
}: {
  slot: SourceSlot;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && ACCEPTED_TYPES.includes(file.type)) onFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-gray-700">
        Source {slot.label}
        {slot.label === "A" && <span className="text-red-500 ml-1">*</span>}
      </span>
      {slot.file ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="truncate flex-1 text-blue-800">{slot.file.name}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-blue-400 hover:text-red-500 transition-colors flex-shrink-0 text-lg leading-none"
            aria-label={`Remove source ${slot.label}`}
          >
            ×
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`cursor-pointer border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors select-none ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
          }`}
        >
          <p className="text-sm text-gray-500">
            Click or drag &amp; drop
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, GIF, PDF</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

export default function UploadForm({ onSubmit, isLoading }: Props) {
  const [slots, setSlots] = useState<SourceSlot[]>([
    { label: "A", file: null },
    { label: "B", file: null },
    { label: "C", file: null },
  ]);
  const [course, setCourse] = useState("30-1");
  const [questionCount, setQuestionCount] = useState(5);
  const [guidance, setGuidance] = useState("");

  function setFile(label: "A" | "B" | "C", file: File | null) {
    setSlots((prev) =>
      prev.map((s) => (s.label === label ? { ...s, file } : s))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const files = slots.filter((s) => s.file !== null).map((s) => s.file!);
    if (files.length === 0) return;
    onSubmit({ sources: files, course, questionCount, guidance });
  }

  const hasSourceA = slots[0].file !== null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Sources */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Upload Sources{" "}
          <span className="font-normal text-gray-500 text-sm">
            (up to 3 — cartoon, image, article, graph, quote)
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {slots.map((slot) => (
            <SourceDropZone
              key={slot.label}
              slot={slot}
              onFile={(file) => setFile(slot.label, file)}
              onRemove={() => setFile(slot.label, null)}
            />
          ))}
        </div>
      </div>

      {/* Course + Question count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="course"
            className="text-sm font-semibold text-gray-700"
          >
            Course
          </label>
          <select
            id="course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {COURSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="questionCount"
            className="text-sm font-semibold text-gray-700"
          >
            Number of Questions:{" "}
            <span className="text-blue-600 font-bold">{questionCount}</span>
          </label>
          <input
            id="questionCount"
            type="range"
            min={1}
            max={20}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1</span>
            <span>20</span>
          </div>
        </div>
      </div>

      {/* Guidance */}
      <div className="flex flex-col gap-1">
        <label htmlFor="guidance" className="text-sm font-semibold text-gray-700">
          Additional guidance{" "}
          <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="guidance"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="e.g. Focus on Related Issue 3. Include one question about nationalism. Avoid questions about economics."
          rows={3}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-gray-400"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!hasSourceA || isLoading}
        className="w-full py-3 px-6 rounded-xl font-semibold text-white text-sm transition-all
          bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating questions…
          </span>
        ) : (
          "Generate Questions"
        )}
      </button>
    </form>
  );
}
