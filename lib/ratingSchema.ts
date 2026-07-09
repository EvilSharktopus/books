// Shared between server and client — no Node imports here.
export const BOOK_TYPES = ["Fiction", "Non-Fiction"] as const;
// Default options for "Where'd you hear about it?" — the form lets the
// user edit this list (stored in localStorage), so stored records may
// contain values beyond these.
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
  source?: string;
  authorCountry?: string;
  submittedAt?: string; // ISO; absent for pre-form backlog entries
}
