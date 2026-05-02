import { Type } from "typebox";
import type { defineTool as definePiTool } from "@mariozechner/pi-coding-agent";
import type { NativeAskQuestion } from "../../shared/desktop-contracts.ts";
import { createPendingNativeAskQuestionsRequest } from "../runtime/native-ask-questions-state.cts";

type RuntimeLike = {
  session: { sessionFile?: string };
};

type TextToolContent = { type: "text"; text: string };

function textContent(text: string): TextToolContent {
  return { type: "text", text };
}

const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "Short answer label." }),
  description: Type.Optional(Type.String({ description: "Short explanation." })),
});

const QuestionSchema = Type.Object({
  id: Type.Optional(Type.String({ description: "Stable question id." })),
  question: Type.String({ description: "Short question for the user." }),
  multiple: Type.Optional(Type.Boolean({ description: "Allow multiple answers." })),
  options: Type.Array(QuestionOptionSchema, { description: "Answer options." }),
});

const AskQuestionsParameters = Type.Object({
  questions: Type.Array(QuestionSchema, { description: "Questions to ask the user." }),
});

function normalizeQuestion(input: unknown, index: number): NativeAskQuestion | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question.trim() : "";
  if (!question) return null;

  const options = Array.isArray(record.options)
    ? record.options
        .map((option) => {
          if (!option || typeof option !== "object") return null;
          const optionRecord = option as Record<string, unknown>;
          const label = typeof optionRecord.label === "string" ? optionRecord.label.trim() : "";
          if (!label) return null;
          const description =
            typeof optionRecord.description === "string" ? optionRecord.description.trim() : "";
          return { label, ...(description ? { description } : {}) };
        })
        .filter((option): option is NonNullable<typeof option> => option !== null)
    : [];

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `q${index + 1}`,
    question,
    multiple: record.multiple === true,
    options,
  };
}

export function createNativeAskQuestionsTools({
  defineTool,
  getRuntime,
  onStateChange,
}: {
  defineTool: typeof definePiTool;
  getRuntime: () => RuntimeLike | null;
  onStateChange: () => void;
}) {
  return [
    defineTool({
      name: "ask_questions",
      label: "Ask questions",
      description: "Ask the user one or more questions and wait for answers.",
      parameters: AskQuestionsParameters,
      promptSnippet:
        "ask_questions: Ask the user short questions when blocked. Use short sentences.",
      promptGuidelines: [
        "Use ask_questions only when you need the user's choice to continue.",
        "Keep questions and options short.",
        "Do not ask for approval when you can pick a safe default.",
      ],
      async execute(_toolCallId: string, params: { questions?: unknown[] }) {
        const runtime = getRuntime();
        const sessionPath = runtime?.session.sessionFile ?? null;
        if (!sessionPath) {
          return { content: [textContent("No session is available.")], details: undefined };
        }

        const questions = Array.isArray(params.questions)
          ? params.questions
              .map((question, index) => normalizeQuestion(question, index))
              .filter((question): question is NativeAskQuestion => question !== null)
          : [];

        if (questions.length === 0) {
          return { content: [textContent("No questions were provided.")], details: undefined };
        }

        const id = `ask_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const answers = await createPendingNativeAskQuestionsRequest(sessionPath, {
          id,
          questions,
        }).finally(onStateChange);
        onStateChange();

        return {
          content: [
            textContent(
              answers
                .map(
                  (answer, index) =>
                    `${questions[index]?.question ?? `Question ${index + 1}`}: ${answer.join(", ") || "No answer"}`,
                )
                .join("\n"),
            ),
          ],
          details: { answers },
        };
      },
    }),
  ];
}
