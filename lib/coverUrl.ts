// Cover URLs are stored at whatever size the lookup happened to return —
// Open Library "S" (≈40px) and "M" (≈180px), Google Books zoom=5/zoom=1
// (≈128px). Both services serve larger renditions of the same image from a
// URL tweak, so instead of migrating the database we upgrade the URL at
// render time. Anything else (user-pasted URLs, uploaded data: URLs) is
// returned untouched.

export type CoverSize = "thumb" | "full";

const OPEN_LIBRARY = /^(https?:\/\/covers\.openlibrary\.org\/b\/(?:id|isbn|olid)\/[^/?#-]+)-[SML]\.jpg(?:\?.*)?$/i;
const GOOGLE_BOOKS = /^https?:\/\/books\.google\.[a-z.]+\/books\/content\?/i;

/**
 * The best rendition of a stored cover URL for the given display size.
 * "thumb" is for tiny list icons; "full" for shelf tiles, modals, Wrapped.
 */
export function coverUrl(url: string, size: CoverSize = "full"): string {
  if (!url) return url;

  const ol = url.match(OPEN_LIBRARY);
  if (ol) {
    // ?default=false makes a missing size 404 instead of returning a blank
    // placeholder image, so <CoverImage> can fall back to the stored URL.
    return `${ol[1]}-${size === "thumb" ? "M" : "L"}.jpg?default=false`;
  }

  if (GOOGLE_BOOKS.test(url)) {
    try {
      const u = new URL(url.replace(/^http:/, "https:"));
      u.searchParams.set("zoom", "1");
      u.searchParams.delete("edge"); // drop the fake page-curl overlay
      if (size === "full") u.searchParams.set("fife", "w400");
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/** The largest version of a cover, for persisting new lookups. */
export function storableCover(url: string): string {
  if (!url) return url;
  const ol = url.match(OPEN_LIBRARY);
  if (ol) return `${ol[1]}-L.jpg`;
  return coverUrl(url, "full");
}

/**
 * Loads a cover as an <img> element for canvas drawing, trying the
 * high-res rendition first and the stored URL if that fails.
 */
export function loadCoverImage(url: string): Promise<HTMLImageElement> {
  const attempt = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`cover failed: ${src}`));
      img.src = src;
    });
  const upgraded = coverUrl(url, "full");
  return upgraded === url
    ? attempt(url)
    : attempt(upgraded).catch(() => attempt(url));
}
