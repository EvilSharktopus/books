import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type SourceFile =
  | {
      label: string;
      type: "file";
      mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
      data: string; // base64-encoded
    }
  | {
      label: string;
      type: "text";
      content: string;
    };

export type GenerateRequest = {
  sources: SourceFile[];
  course: string;
  questionCount: number;
  posContent: string;
  examFormatContent: string;
  guidance: string;
};

export type GeneratedQuestions = {
  raw: string; // full markdown text of question set
};

const READING_LEVELS: Record<string, string> = {
  "10-1": "moderate to strong Grade 10 (clear language, accessible vocabulary, straightforward stems)",
  "10-2": "moderate to weak Grade 10 (simple sentence structure, plain vocabulary, very direct stems)",
  "20-1": "moderate to strong Grade 11 (some complexity in phrasing, developing analytical vocabulary)",
  "20-2": "moderate to weak Grade 11 (clear and direct, avoid dense or layered phrasing)",
  "30-1": "moderate to strong Grade 12 (sophisticated vocabulary, nuanced stems, complex analytical demands)",
  "30-2": "moderate to weak Grade 12 (accessible Grade 12 language, avoid overly academic phrasing)",
};

export async function generateQuestions(
  req: GenerateRequest
): Promise<GeneratedQuestions> {
  const { sources, course, questionCount, posContent, examFormatContent, guidance } = req;

  const sourceDescriptions = sources
    .map((s) => `Source ${s.label}`)
    .join(", ");

  const readingLevel = READING_LEVELS[course] ?? "appropriate for the course level";

  const systemPrompt = `You are an expert Alberta Social Studies exam writer with deep knowledge of the ${course} Program of Studies and Alberta Education assessment conventions.

Your task is to generate high-quality, curriculum-aligned exam questions based on uploaded sources. You must follow all formatting conventions exactly.

## Reading Level
All questions and answer options must be written at a **${readingLevel}** reading level. This applies to question stems, all four options, and any source references. Do not write above or below this level.

## Formatting Rules (follow precisely)
${examFormatContent}

## Program of Studies for ${course}
${posContent}

## Question Writing Principles
1. **Bloom's Taxonomy — escalating difficulty**: Questions must increase in cognitive demand from first to last:
   - Begin with Remember/Understand (recall, identify, define) — easiest
   - Progress through Apply/Analyze (interpret, compare, explain cause/effect, identify perspective)
   - End with Evaluate/Create (judge, argue, synthesize across sources, construct a position) — hardest
   - No question should be at a lower Bloom's level than the one before it

2. **Multiple Choice quality rules**:
   - All four options (A, B, C, D) are plausible
   - Exactly ONE correct answer — no ambiguity
   - No "all of the above", "none of the above", or trick questions
   - Stems are complete questions, not sentence fragments
   - Distractors reflect common student misconceptions, not random wrong answers
   - Distractors are parallel in structure and length to the correct answer

3. **Source integration**:
   - Single-source questions: "According to Source A…" or "The perspective in Source B best represents…"
   - Cross-source questions (when 2+ sources provided): "Using Sources A and B…" or "Which statement best describes the relationship between Sources A and C?"
   - Written response: Student must draw on ALL provided sources

4. **Alberta 30-1 conventions**:
   - Each question cites the relevant PoS outcome in metadata: *(Related Issue X, Outcome X.X)*
   - Each question tags its Bloom's level: *(Bloom's Level: Apply/Analyze)*
   - Mark allocation shown per question
   - Written response questions state a clear issue and require students to take and defend a position

5. **Curriculum alignment**: Every question must connect to a specific PoS outcome from the ${course} program. Do not generate generic or off-curriculum questions.`;

  const userContent: Anthropic.MessageParam["content"] = [];

  // Add sources (images, PDFs, or plain text)
  for (const source of sources) {
    userContent.push({
      type: "text",
      text: `The following is Source ${source.label}:`,
    });

    if (source.type === "text") {
      userContent.push({ type: "text", text: source.content });
    } else if (source.mediaType === "application/pdf") {
      userContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: source.data,
        },
      } as Anthropic.DocumentBlockParam);
    } else {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: source.mediaType,
          data: source.data,
        },
      });
    }
  }

  userContent.push({
    type: "text",
    text: `Please generate exactly ${questionCount} exam questions for Social Studies ${course} based on ${sourceDescriptions}.

Requirements:
- Generate ${questionCount} questions total
- All questions must be Multiple Choice (4 options: A, B, C, D) — do NOT include Written Response or Part B questions
- Follow the formatting guide exactly (headers, source labels, Bloom's tags, PoS citations, mark allocation)
- Begin with a question set header showing course, total marks
- Number questions sequentially
- For cross-source questions, explicitly reference which sources the student should use
${guidance.trim() ? `\nAdditional instructions from the teacher:\n${guidance.trim()}` : ""}
Output the complete question set in clean markdown, ready to copy into a Word document.`,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return { raw: text };
}
