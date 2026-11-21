// Small, dependency-free helpers for deciding whether two book records are
// the same book, and whether a looked-up detail is believable.

/** Name tokens (≥3 letters, accents stripped) from an authors string. */
export function authorTokens(authors: string): Set<string> {
  return new Set(
    authors
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3)
  );
}

/** Do two author strings share a name? Unknown authors on our side match
 *  anything (there's nothing to check against). */
export function authorsOverlap(ours: string, theirs: string | string[] | undefined): boolean {
  const mine = authorTokens(ours);
  if (mine.size === 0) return true;
  const other = Array.isArray(theirs) ? theirs.join(" ") : theirs ?? "";
  return [...authorTokens(other)].some((t) => mine.has(t));
}

/** A page count worth trusting, as a string, or "". Indexes sometimes report
 *  sample/preview editions ("10", "36") — no novel or memoir is that short. */
export function plausiblePages(pages: string | number | undefined | null): string {
  const n = typeof pages === "number" ? pages : parseInt(pages ?? "", 10);
  return n >= 40 && n <= 3000 ? String(n) : "";
}
