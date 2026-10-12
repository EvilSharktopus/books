import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractedBook {
  title: string;
  author: string;
}

export interface PhotoImage {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string; // base64-encoded
}

const SYSTEM_PROMPT = `You identify books from photos of bookshelves, stacks, or covers for a personal book-tracking app.

Respond with ONLY a JSON object of this exact shape, no prose and no markdown code fences:
{"books":[{"title":"...","author":"..."}]}

Rules:
- Include every distinct book you can identify across all photos provided in this request.
- If the same book appears in more than one photo, include it only once.
- If you can read the title but not the author, set "author" to an empty string.
- If text is too blurry, cropped, or ambiguous to confidently identify a real published book, omit it rather than guessing.
- Do not include magazines, boxed sets as a single spine, or non-book objects.
- Use the book's real title and author name (correcting obvious OCR issues), not the raw text exactly as it appears on the spine.`;

export async function extractBooksFromPhotos(
  images: PhotoImage[]
): Promise<ExtractedBook[]> {
  const content: Anthropic.MessageParam["content"] = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.data,
    },
  }));

  content.push({
    type: "text",
    text: "Identify every book visible in these photos. Respond with only the JSON object described in your instructions.",
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { books?: unknown };
    if (!Array.isArray(parsed.books)) return [];
    return parsed.books
      .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
      .map((b) => ({
        title: typeof b.title === "string" ? b.title.trim() : "",
        author: typeof b.author === "string" ? b.author.trim() : "",
      }))
      .filter((b) => b.title.length > 0);
  } catch {
    return [];
  }
}
