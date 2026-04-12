import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type SourceFile = {
  label: string; // "A", "B", "C"
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
  data: string; // base64-encoded
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

export async function generateQuestions(
  req: GenerateRequest
): Promise<GeneratedQuestions> {
  const { sources, course, questionCount, posContent, examFormatContent, guidance } = req;

  const sourceDescriptions = sources
    .map((s) => `Source ${s.label}`)
    .join(", ");

  const systemPrompt = `You are an expert Alberta Social Studies diploma exam writer with deep knowledge of the ${course} Program of Studies and Alberta Education assessment conventions.

Your task is to generate high-quality, curriculum-aligned exam questions based on uploaded sources. You must follow all formatting conventions exactly.

## Formatting Rules (follow precisely)
${examFormatContent}

## Program of Studies for ${course}
${posContent}

## Question Writing Principles
1. **Bloom's Taxonomy distribution**: Spread questions across cognitive levels:
   - ~20% Remember/Understand (recall, identify, define)
   - ~50% Apply/Analyze (interpret, compare, explain cause/effect, identify perspective)
   - ~30% Evaluate/Create (judge, argue, synthesize across sources, construct a position)

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

  // Add source images/PDFs
  for (const source of sources) {
    userContent.push({
      type: "text",
      text: `The following is Source ${source.label}:`,
    });

    if (source.mediaType === "application/pdf") {
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
