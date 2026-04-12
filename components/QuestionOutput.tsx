"use client";

import { useState } from "react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

type Props = {
  markdown: string;
  onReset: () => void;
};

// Minimal markdown → docx paragraph converter
function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }

    // Heading levels
    if (trimmed.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.slice(4),
          heading: HeadingLevel.HEADING_3,
        })
      );
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.slice(3),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (trimmed.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.slice(2),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      // Bold line (e.g. "**Written Response 1**")
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: trimmed.slice(2, -2), bold: true }),
          ],
        })
      );
    } else if (/^[A-D]\.\s/.test(trimmed)) {
      // MCQ option — indent slightly
      paragraphs.push(
        new Paragraph({
          text: trimmed,
          indent: { left: 360 },
        })
      );
    } else if (/^\*\(/.test(trimmed)) {
      // Metadata lines like *(Bloom's Level: ...)* — italic, small
      const text = trimmed.replace(/\*/g, "");
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text, italics: true, size: 18 })],
          alignment: AlignmentType.RIGHT,
        })
      );
    } else {
      // Default paragraph — handle inline bold
      const runs: TextRun[] = [];
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else {
          runs.push(new TextRun({ text: part }));
        }
      }
      paragraphs.push(new Paragraph({ children: runs }));
    }
  }

  return paragraphs;
}

async function downloadAsWord(markdown: string) {
  const paragraphs = markdownToDocxParagraphs(markdown);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "question-set.docx");
}

// Very simple markdown renderer for on-screen display
function renderMarkdown(markdown: string): React.ReactNode[] {
  const lines = markdown.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) return <br key={i} />;

    if (trimmed.startsWith("# ")) {
      return (
        <h1 key={i} className="text-xl font-bold mt-4 mb-2 text-gray-900">
          {trimmed.slice(2)}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} className="text-lg font-bold mt-4 mb-1 text-gray-800">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={i} className="text-base font-semibold mt-3 mb-1 text-gray-700">
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (/^\*\(/.test(trimmed)) {
      return (
        <p key={i} className="text-xs text-gray-400 italic text-right mt-0.5">
          {trimmed.replace(/\*/g, "")}
        </p>
      );
    }
    if (/^[A-D]\.\s/.test(trimmed)) {
      return (
        <p key={i} className="ml-6 text-sm text-gray-700">
          {trimmed}
        </p>
      );
    }

    // Inline bold
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={j}>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    );

    return (
      <p key={i} className="text-sm text-gray-800 leading-relaxed mt-1">
        {rendered}
      </p>
    );
  });
}

export default function QuestionOutput({ markdown, onReset }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadAsWord(markdown);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Actions */}
      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Word (.docx)
            </>
          )}
        </button>

        <button
          onClick={() => {
            navigator.clipboard.writeText(markdown);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Text
        </button>

        <button
          onClick={onReset}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
        >
          New Question Set
        </button>
      </div>

      {/* Rendered output */}
      <div className="border border-gray-200 rounded-xl bg-white p-4 sm:p-6 shadow-sm overflow-auto max-h-[70vh]">
        <div className="prose prose-sm max-w-none">
          {renderMarkdown(markdown)}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 italic text-center px-2">
        These questions are a starting point only — always review for oversimplifications, misunderstandings, and errors before use.
      </p>
    </div>
  );
}
