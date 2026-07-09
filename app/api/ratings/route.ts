import { appendFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rateLimit";

const checkRateLimit = createRateLimiter(20);

const RATINGS_FILE = path.join(process.cwd(), "data", "ratings.jsonl");

type FieldSpec = {
  label: string;
  required: boolean;
  maxLength: number;
};

// Text fields, kept declarative so matching the Google Form's exact
// questions later is a one-entry change.
const TEXT_FIELDS = {
  bookTitle: { label: "Book title", required: true, maxLength: 200 },
  author: { label: "Author", required: true, maxLength: 200 },
  authorCountry: { label: "Author country", required: false, maxLength: 100 },
  comments: { label: "Comments", required: false, maxLength: 2000 },
} satisfies Record<string, FieldSpec>;

type TextField = keyof typeof TEXT_FIELDS;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached. Try again tomorrow." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request format." },
      { status: 400 }
    );
  }

  const record: Record<string, string | number> = {};

  for (const [field, spec] of Object.entries(TEXT_FIELDS) as [
    TextField,
    FieldSpec
  ][]) {
    const raw = body[field];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (spec.required) {
        return NextResponse.json(
          { error: `${spec.label} is required.` },
          { status: 400 }
        );
      }
      continue;
    }
    if (value.length > spec.maxLength) {
      return NextResponse.json(
        { error: `${spec.label} must be ${spec.maxLength} characters or fewer.` },
        { status: 400 }
      );
    }
    record[field] = value;
  }

  const rating = body.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json(
      { error: "Rating must be a whole number from 1 to 5." },
      { status: 400 }
    );
  }
  record.rating = rating;
  record.submittedAt = new Date().toISOString();

  try {
    // Note: file writes are ephemeral on Vercel serverless — fine for local or
    // self-hosted use. To persist in production, swap this append for Vercel
    // Blob/KV/Postgres or a Google Sheets append.
    await appendFile(RATINGS_FILE, JSON.stringify(record) + "\n", "utf-8");
  } catch (err) {
    console.error("[ratings] Failed to save rating:", err);
    return NextResponse.json(
      { error: "Failed to save your rating. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
