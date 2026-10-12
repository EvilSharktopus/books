import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rateLimit";
import { extractBooksFromPhotos, PhotoImage } from "@/lib/bookExtraction";
import { prepareImageBuffer } from "@/lib/imagePrep";

// Separate quota from the exam-generator route.
const checkRateLimit = createRateLimiter(20);

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

function isSupportedImageType(type: string): type is SupportedImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export const maxDuration = 60; // seconds — requires Vercel Pro; on Hobby this is capped at 10s

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached for photo scans. Try again tomorrow." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request format." },
      { status: 400 }
    );
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one photo is required." },
      { status: 400 }
    );
  }
  if (files.length > 6) {
    return NextResponse.json(
      { error: "Please upload at most 6 photos at a time." },
      { status: 400 }
    );
  }

  const images: PhotoImage[] = [];
  for (const file of files) {
    if (!isSupportedImageType(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Supported: JPEG, PNG, GIF, WebP.` },
        { status: 400 }
      );
    }
    const rawBuffer = Buffer.from(await file.arrayBuffer()) as Buffer<ArrayBuffer>;
    const prepared = await prepareImageBuffer(rawBuffer, file.type);
    images.push({
      mediaType: prepared.mediaType as SupportedImageType,
      data: prepared.buffer.toString("base64"),
    });
  }

  try {
    const books = await extractBooksFromPhotos(images);
    return NextResponse.json(
      { books },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (err) {
    console.error("[extract-books] Claude API error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to scan photos. Please try again." },
      { status: 500 }
    );
  }
}
