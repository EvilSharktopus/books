import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateQuestions, SourceFile } from "@/lib/claude";

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
type SupportedMediaType = SupportedImageType | "application/pdf";

function isSupportedMediaType(type: string): type is SupportedMediaType {
  return (
    SUPPORTED_IMAGE_TYPES.includes(type as SupportedImageType) ||
    type === "application/pdf"
  );
}

function loadDataFile(relativePath: string): string {
  const filePath = path.join(process.cwd(), "data", relativePath);
  return readFileSync(filePath, "utf-8");
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Daily limit reached. You can generate up to 5 question sets per day. Try again tomorrow.",
      },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      }
    );
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request format." },
      { status: 400 }
    );
  }

  const course = formData.get("course") as string | null;
  const questionCountRaw = formData.get("questionCount") as string | null;

  if (!course || !questionCountRaw) {
    return NextResponse.json(
      { error: "Missing required fields: course, questionCount." },
      { status: 400 }
    );
  }

  const questionCount = parseInt(questionCountRaw, 10);
  if (isNaN(questionCount) || questionCount < 1 || questionCount > 20) {
    return NextResponse.json(
      { error: "questionCount must be between 1 and 20." },
      { status: 400 }
    );
  }

  // Collect uploaded source files (sourceA, sourceB, sourceC)
  const sourceLabels = ["A", "B", "C"] as const;
  const sources: SourceFile[] = [];

  for (const label of sourceLabels) {
    const file = formData.get(`source${label}`) as File | null;
    if (!file || file.size === 0) continue;

    if (!isSupportedMediaType(file.type)) {
      return NextResponse.json(
        {
          error: `Source ${label} has unsupported file type: ${file.type}. Supported: JPEG, PNG, GIF, WebP, PDF.`,
        },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    sources.push({
      label,
      mediaType: file.type as SupportedMediaType,
      data: base64,
    });
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "At least one source file is required." },
      { status: 400 }
    );
  }

  // Load curriculum data
  let posContent: string;
  let examFormatContent: string;
  try {
    posContent = loadDataFile(`pos/${course}.md`);
    examFormatContent = loadDataFile("examples/exam-format.md");
  } catch {
    return NextResponse.json(
      {
        error: `Course "${course}" is not yet supported. Please check back later.`,
      },
      { status: 400 }
    );
  }

  // Generate questions
  try {
    const result = await generateQuestions({
      sources,
      course,
      questionCount,
      posContent,
      examFormatContent,
    });

    return NextResponse.json(
      { questions: result.raw },
      {
        headers: { "X-RateLimit-Remaining": String(remaining) },
      }
    );
  } catch (err) {
    console.error("Generation error:", err);
    return NextResponse.json(
      {
        error:
          "Failed to generate questions. Please try again. If the problem persists, the AI service may be temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
