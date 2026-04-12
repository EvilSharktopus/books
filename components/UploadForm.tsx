"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

export type SourceEntry =
  | { type: "file"; file: File }
  | { type: "text"; text: string };

export type FormValues = {
  sources: SourceEntry[];
  course: string;
  questionCount: number;
  guidance: string;
};

type SourceSlot = {
  label: "A" | "B" | "C";
  mode: "file" | "text";
  file: File | null;
  text: string;
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

function SourceSlotInput({
  slot,
  onFile,
  onRemoveFile,
  onText,
  onMode,
}: {
  slot: SourceSlot;
  onFile: (file: File) => void;
  onRemoveFile: () => void;
  onText: (text: string) => void;
  onMode: (mode: "file" | "text") => void;
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

  const isRequired = slot.label === "A";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label + toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          Source {slot.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </span>
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => onMode("file")}
            className={`px-2 py-1 transition-colors ${
              slot.mode === "file"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => onMode("text")}
            className={`px-2 py-1 transition-colors ${
              slot.mode === "text"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Text
          </button>
        </div>
      </div>

      {/* File mode */}
      {slot.mode === "file" && (
        <>
          {slot.file ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <span className="truncate flex-1 text-blue-800">{slot.file.name}</span>
              <button
                type="button"
                onClick={onRemoveFile}
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
              <p className="text-sm text-gray-500">Click or drag &amp; drop</p>
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
        </>
      )}

      {/* Text mode */}
      {slot.mode === "text" && (
        <textarea
          value={slot.text}
          onChange={(e) => onText(e.target.value)}
          placeholder="Paste or type source text here…"
          rows={4}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-gray-400"
        />
      )}
    </div>
  );
}

export default function UploadForm({ onSubmit, isLoading }: Props) {
  const [slots, setSlots] = useState<SourceSlot[]>([
    { label: "A", mode: "file", file: null, text: "" },
    { label: "B", mode: "file", file: null, text: "" },
    { label: "C", mode: "file", file: null, text: "" },
  ]);
  const [course, setCourse] = useState("30-1");
  const [questionCount, setQuestionCount] = useState(5);
  const [guidance, setGuidance] = useState("");

  function updateSlot(label: "A" | "B" | "C", patch: Partial<SourceSlot>) {
    setSlots((prev) => prev.map((s) => (s.label === label ? { ...s, ...patch } : s)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sources: SourceEntry[] = slots
      .filter((s) => (s.mode === "file" ? s.file !== null : s.text.trim() !== ""))
      .map((s) =>
        s.mode === "file"
          ? { type: "file" as const, file: s.file! }
          : { type: "text" as const, text: s.text.trim() }
      );
    if (sources.length === 0) return;
    onSubmit({ sources, course, questionCount, guidance });
  }

  const slotA = slots[0];
  const hasSourceA =
    slotA.mode === "file" ? slotA.file !== null : slotA.text.trim() !== "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Sources */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Sources{" "}
          <span className="font-normal text-gray-500 text-sm">
            (up to 3 — cartoon, image, article, graph, quote, or typed text)
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {slots.map((slot) => (
            <SourceSlotInput
              key={slot.label}
              slot={slot}
              onFile={(file) => updateSlot(slot.label, { file })}
              onRemoveFile={() => updateSlot(slot.label, { file: null })}
              onText={(text) => updateSlot(slot.label, { text })}
              onMode={(mode) => updateSlot(slot.label, { mode, file: null, text: "" })}
            />
          ))}
        </div>
      </div>

      {/* Course + Question count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="course" className="text-sm font-semibold text-gray-700">
            Course
          </label>
          <select
            id="course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {COURSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="questionCount" className="text-sm font-semibold text-gray-700">
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none placeholder-gray-400"
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

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 italic text-center">
        This tool is just to provide your first steps — always check the questions for oversimplifications, misunderstandings, and flat out errors.
      </p>
    </form>
  );
}
