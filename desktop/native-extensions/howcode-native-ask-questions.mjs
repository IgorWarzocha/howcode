import { Type } from "typebox";
import { Editor, Key, Text, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

const OptionSchema = Type.Object({
  label: Type.String({ description: "Short answer label." }),
  description: Type.Optional(Type.String({ description: "Short explanation." })),
});

const QuestionSchema = Type.Object({
  id: Type.Optional(Type.String({ description: "Stable question id." })),
  question: Type.String({ description: "Short question for the user." }),
  multiple: Type.Optional(Type.Boolean({ description: "Allow multiple answers." })),
  options: Type.Array(OptionSchema, { description: "Answer options." }),
});

const AskQuestionsParameters = Type.Object({
  questions: Type.Array(QuestionSchema, { description: "Questions to ask the user." }),
});

function textContent(text) {
  return { type: "text", text };
}

function normalizeQuestion(input, index) {
  if (!input || typeof input !== "object") return null;
  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (!question) return null;
  const options = Array.isArray(input.options)
    ? input.options
        .map((option) => {
          if (!option || typeof option !== "object") return null;
          const label = typeof option.label === "string" ? option.label.trim() : "";
          if (!label) return null;
          const description =
            typeof option.description === "string" ? option.description.trim() : "";
          return { label, ...(description ? { description } : {}) };
        })
        .filter(Boolean)
    : [];
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `q${index + 1}`,
    question,
    multiple: input.multiple === true,
    options,
  };
}

function normalizeQuestions(params) {
  return Array.isArray(params?.questions)
    ? params.questions.map((question, index) => normalizeQuestion(question, index)).filter(Boolean)
    : [];
}

function summarizeAnswers(questions, answers) {
  return answers
    .map(
      (answer, index) =>
        `${questions[index]?.question ?? `Question ${index + 1}`}: ${answer.join(", ") || "No answer"}`,
    )
    .join("\n");
}

async function askInTui(ctx, questions) {
  if (!ctx.hasUI) return null;
  return await ctx.ui.custom((tui, theme, _kb, done) => {
    let tab = 0;
    let focus = 0;
    let editing = false;
    let cached;
    const answers = questions.map(() => []);
    const custom = questions.map(() => "");
    const customOn = questions.map(() => false);
    const editor = new Editor(tui, {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    });

    const reviewTab = () => questions.length;
    const current = () => questions[tab];
    const options = () => current()?.options ?? [];
    const isReview = () => tab === reviewTab();
    const count = () => options().length + 1;
    const refresh = () => {
      cached = undefined;
      tui.requestRender();
    };
    const answered = (index) =>
      (answers[index]?.length ?? 0) > 0 || (customOn[index] && custom[index].trim());
    const setTab = (next) => {
      tab = Math.max(0, Math.min(reviewTab(), next));
      focus = 0;
      editing = false;
      editor.setText(custom[tab] ?? "");
      refresh();
    };
    const saveCustom = () => {
      const previous = custom[tab]?.trim() ?? "";
      const value = editor.getText().trim();
      custom[tab] = editor.getText();
      customOn[tab] = Boolean(value);
      if (!value) {
        if (previous) answers[tab] = answers[tab].filter((item) => item !== previous);
        return;
      }
      if (current()?.multiple) {
        answers[tab] = [
          ...answers[tab].filter((item) => item !== value && item !== previous),
          value,
        ];
      } else {
        answers[tab] = [value];
      }
    };
    editor.onSubmit = () => {
      saveCustom();
      editing = false;
      refresh();
    };
    const pick = (index) => {
      const option = options()[index];
      if (!option) return;
      if (current()?.multiple) {
        answers[tab] = answers[tab].includes(option.label)
          ? answers[tab].filter((item) => item !== option.label)
          : [...answers[tab], option.label];
      } else {
        answers[tab] = [option.label];
        customOn[tab] = false;
      }
      refresh();
    };
    const handleInput = (data) => {
      if (editing) {
        if (matchesKey(data, Key.escape)) {
          editing = false;
          editor.setText(custom[tab] ?? "");
          refresh();
          return;
        }
        editor.handleInput(data);
        refresh();
        return;
      }
      if (matchesKey(data, Key.escape)) return done(null);
      if (matchesKey(data, Key.left)) return setTab(tab - 1);
      if (matchesKey(data, Key.right)) return setTab(tab + 1);
      if (isReview()) {
        if (matchesKey(data, Key.enter)) done(answers);
        return;
      }
      if (matchesKey(data, Key.up)) {
        focus = Math.max(0, focus - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down)) {
        focus = Math.min(count() - 1, focus + 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.enter)) {
        if (focus === options().length) {
          editing = true;
          editor.setText(custom[tab] ?? "");
          refresh();
          return;
        }
        pick(focus);
      }
    };
    const render = (width) => {
      if (cached) return cached;
      const lines = [];
      const add = (line = "") => lines.push(truncateToWidth(line, width));
      add(theme.fg("accent", "─".repeat(width)));
      add(
        ` ${Array.from({ length: questions.length + 1 }, (_, index) => {
          const active = index === tab;
          const label =
            index === questions.length ? "Review" : `${answered(index) ? "■" : "□"} ${index + 1}`;
          return active
            ? theme.bg("selectedBg", theme.fg("text", ` ${label} `))
            : theme.fg("muted", ` ${label} `);
        }).join(" ")}`,
      );
      add();
      if (isReview()) {
        add(theme.fg("accent", " Review"));
        add();
        questions.forEach((question, index) => {
          add(theme.fg("muted", ` ${index + 1}. ${question.question}`));
          add(theme.fg("text", `    ${(answers[index] ?? []).join(", ") || "No answer"}`));
        });
        add();
        add(theme.fg("dim", " Enter submits • ←/→ questions • Esc dismisses"));
      } else {
        const question = current();
        add(
          theme.fg("text", ` ${question.question} `) +
            theme.fg("muted", question.multiple ? "Pick any that apply" : "Pick one"),
        );
        add();
        options().forEach((option, index) => {
          const selected = focus === index;
          const checked = answers[tab]?.includes(option.label);
          add(
            `${selected ? theme.fg("accent", "> ") : "  "}${checked ? theme.fg("success", "✓ ") : "  "}${theme.fg(
              selected ? "accent" : "text",
              option.label,
            )}`,
          );
          if (option.description) add(`    ${theme.fg("muted", option.description)}`);
        });
        const selectedOther = focus === options().length;
        add(
          `${selectedOther ? theme.fg("accent", "> ") : "  "}${customOn[tab] ? theme.fg("success", "✓ ") : "  "}${theme.fg(
            selectedOther ? "accent" : "muted",
            "Other",
          )}${custom[tab]?.trim() ? theme.fg("text", `: ${custom[tab].trim()}`) : ""}`,
        );
        if (editing) {
          add();
          for (const line of editor.render(width - 2)) add(` ${line}`);
        }
        add();
        add(theme.fg("dim", " ↑↓ options • Enter selects/types • ←/→ questions • Esc dismisses"));
      }
      add(theme.fg("accent", "─".repeat(width)));
      cached = lines;
      return lines;
    };
    return {
      render,
      handleInput,
      invalidate: () => {
        cached = undefined;
      },
    };
  });
}

export function createHowcodeAskQuestionsTool({ defineTool, askInComposer } = {}) {
  if (!defineTool) throw new Error("defineTool is required");
  return defineTool({
    name: "ask_questions",
    label: "Ask questions",
    description: "Ask the user one or more questions and wait for answers.",
    parameters: AskQuestionsParameters,
    promptSnippet: "ask_questions: Ask the user short questions when blocked. Use short sentences.",
    promptGuidelines: [
      "Use ask_questions only when you need the user's choice to continue.",
      "Keep questions and options short.",
      "Do not ask for approval when you can pick a safe default.",
    ],
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const questions = normalizeQuestions(params);
      if (questions.length === 0) {
        return { content: [textContent("No questions were provided.")] };
      }

      const answers = askInComposer
        ? await askInComposer(questions, signal)
        : await askInTui(ctx, questions);
      if (!answers) {
        return { content: [textContent("Questions dismissed.")], isError: true };
      }
      return { content: [textContent(summarizeAnswers(questions, answers))], details: { answers } };
    },
    renderCall(args, theme) {
      const count = Array.isArray(args.questions) ? args.questions.length : 0;
      return new Text(
        theme.fg("toolTitle", theme.bold("ask_questions ")) +
          theme.fg("muted", `${count} question${count === 1 ? "" : "s"}`),
        0,
        0,
      );
    },
    renderResult(result, _options, theme) {
      const text = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      return new Text(theme.fg(result.isError ? "warning" : "success", text), 0, 0);
    },
  });
}

export default function howcodeNativeAskQuestions(pi) {
  pi.registerTool(createHowcodeAskQuestionsTool({ defineTool: (tool) => tool }));
}
