// Shared between server and client — no Node imports here.
export const BOOK_TYPES = ["Fiction", "Non-Fiction"] as const;
export const RATING_SOURCES = [
  "Friend",
  "Internet",
  "CBC",
  "Mum",
  "Other",
] as const;

export interface BookRating {
  bookTitle: string;
  author?: string;
  type?: (typeof BOOK_TYPES)[number];
  rating?: number; // integer 1–10
  comments?: string;
  source?: (typeof RATING_SOURCES)[number];
  authorCountry?: string;
  submittedAt?: string; // ISO; absent for pre-form backlog entries
}
