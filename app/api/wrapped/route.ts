import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface WrappedBook {
  title: string;
  authors: string;
  myRating: number;
}

const FACTS_SCHEMA = {
  type: "object" as const,
  properties: {
    facts: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          emoji: { type: "string" as const },
          title: { type: "string" as const },
          text: { type: "string" as const },
        },
        required: ["emoji", "title", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["facts"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // No key configured — the Wrapped UI simply skips the facts slide.
    return NextResponse.json({ facts: [] });
  }

  const { userName, year, books, stats } = (await request.json()) as {
    userName: string;
    year: number;
    books: WrappedBook[];
    stats: Record<string, string | number>;
  };
  if (!Array.isArray(books) || books.length === 0) {
    return NextResponse.json({ facts: [] });
  }

  const bookList = books
    .slice(0, 80)
    .map((b) => `- "${b.title}" by ${b.authors} (rated ${b.myRating}/10)`)
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: FACTS_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `You are writing fun facts for a Spotify-Wrapped-style "Year in Books" recap for a reader named ${userName}, covering ${year}.

Their books this year:
${bookList}

Their stats: ${JSON.stringify(stats)}

Write 4 delightful, specific fun facts about their reading year. Draw on what you know about these authors and books — prize wins, surprising author connections, themes that run across their choices, what their taste says about them. Be warm and playful, like Spotify Wrapped copy. Each fact: an emoji, a short punchy title (max 6 words), and 1-2 sentences of text. Never invent facts about books or authors you don't recognize — prefer facts about the books you know.`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = textBlock ? JSON.parse(textBlock.text) : { facts: [] };
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[wrapped] Claude facts failed:", err);
    return NextResponse.json({ facts: [] });
  }
}
