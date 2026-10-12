import { readFile } from "fs/promises";
import path from "path";
import type { BookRating } from "@/lib/ratingSchema";

export { BOOK_TYPES, RATING_SOURCES } from "@/lib/ratingSchema";
export type { BookRating };

// Foundational data imported from the original Google Sheet (committed).
const SEED_FILE = path.join(process.cwd(), "data", "seed-ratings.jsonl");
// New submissions from the site (gitignored user data).
export const RATINGS_FILE = path.join(process.cwd(), "data", "ratings.jsonl");

async function readJsonl(file: string): Promise<BookRating[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf-8");
  } catch {
    return [];
  }
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as BookRating);
}

export async function loadAllRatings(): Promise<BookRating[]> {
  const [seed, submitted] = await Promise.all([
    readJsonl(SEED_FILE),
    readJsonl(RATINGS_FILE),
  ]);
  return [...seed, ...submitted];
}
