// Hand-written Wrapped extras, keyed by user id then year.
//
// The "literary twin" is written by hand (well, by Claude, in a chat) from
// each reader's books rated 8+ and their review notes, rather than generated
// by the site, so it needs no API key. To add next year's, add an entry here.

export interface LiteraryTwin {
  character: { name: string; from: string; because: string };
  author: { name: string; because: string };
}

const TWINS: Record<string, Record<number, LiteraryTwin>> = {
  // Hilary
  NGW4m1yqzKabcvCcoRlk: {
    2026: {
      character: {
        name: "Lucy Barton",
        from: "Elizabeth Strout's My Name Is Lucy Barton",
        because:
          "Your tens were whole lives told plainly: the letters of The Correspondent, the grief of Things in Nature Merely Grow, the friendship of Kin. Lucy watches people closely, forgives them, and cries when it's earned.",
      },
      author: {
        name: "Elizabeth Strout",
        because:
          "Women, family and loss in quiet, exact sentences. “Insightful” and “readable” are words your reviews keep reaching for, and they describe her too.",
      },
    },
  },
  // Maddy
  zWDsS93GsnDkSbcSlDAv: {
    2026: {
      character: {
        name: "Hans Castorp",
        from: "Thomas Mann's The Magic Mountain",
        because:
          "You went up the mountain for a short visit and stayed: Krasznahorkai, Fontane, Seethaler, Ernaux, Ferrante. An unhurried reader of European novels who also wants to know how plants think and how a shipwreck unravels.",
      },
      author: {
        name: "W. G. Sebald",
        because:
          "Translated, melancholy, and full of nature and history. “Atmosphere” and “style” top your review words, and nobody has more of either.",
      },
    },
  },
};

export function literaryTwin(userId: string, year: number): LiteraryTwin | null {
  return TWINS[userId]?.[year] ?? null;
}

// --- Fun comparisons -------------------------------------------------------

export const WORDS_PER_PAGE = 275; // typical trade paperback
export const READING_WPM = 250;
export const BOOK_HEIGHT_M = 0.21; // a paperback stood on end

const WORD_REFS: { words: number; name: string }[] = [
  { words: 1_084_000, name: "the entire Harry Potter series" },
  { words: 587_000, name: "War and Peace" },
  { words: 480_000, name: "The Lord of the Rings" },
  { words: 95_000, name: "The Hobbit" },
];

/** "about 2× the entire Harry Potter series" — the biggest reference read at least 1.5 times over. */
export function wordsComparison(words: number): string | null {
  const ref = WORD_REFS.find((r) => words / r.words >= 1.5);
  if (!ref) return null;
  const times = words / ref.words;
  const shown = times >= 10 ? Math.round(times) : Math.round(times * 2) / 2;
  return `${shown}× ${ref.name}`;
}

const LENGTH_REFS: { m: number; name: string }[] = [
  { m: 30, name: "a blue whale" },
  { m: 23.8, name: "a tennis court" },
  { m: 18.3, name: "a bowling lane" },
  { m: 12, name: "a school bus" },
  { m: 8, name: "an orca" },
  { m: 5.5, name: "a giraffe is tall" },
  { m: 4.5, name: "a car" },
  { m: 2, name: "a doorway is tall" },
];

/** "longer than an orca" — the biggest thing the line of books beats. */
export function lengthComparison(metres: number): string | null {
  const ref = LENGTH_REFS.find((r) => metres >= r.m);
  return ref ? `longer than ${ref.name}` : null;
}
