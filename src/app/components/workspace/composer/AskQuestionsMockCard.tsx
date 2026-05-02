import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../../utils/cn";

type AskQuestionOption = {
  label: string;
  description?: string;
};

type AskQuestion = {
  id: string;
  question: string;
  multiple?: boolean;
  options: AskQuestionOption[];
};

type AskQuestionsMockCardProps = {
  composerDraft: string;
  onUseComposerDraft: () => string;
  onAnswered?: () => void;
  onDismiss?: () => void;
  registerArrowNavigation?: (handler: ((direction: "previous" | "next") => boolean) | null) => void;
  registerComposerSubmit?: (handler: (() => boolean) | null) => void;
};

const mockQuestions: AskQuestion[] = [
  {
    id: "scope",
    question: "Which parts should I prioritize first?",
    multiple: true,
    options: [
      { label: "Database state", description: "Session snapshots and persistence." },
      { label: "Desktop UI", description: "Composer-adjacent question card." },
      { label: "Pi TUI", description: "Terminal takeover behavior." },
    ],
  },
  {
    id: "style",
    question: "How should I handle unclear choices?",
    options: [
      { label: "Pick a safe default", description: "Continue without blocking." },
      { label: "Ask me", description: "Pause and wait for an answer." },
      { label: "Leave a TODO", description: "Mark the uncertainty in code." },
    ],
  },
];

function getInitialAnswers() {
  return mockQuestions.map(() => [] as string[]);
}

export function AskQuestionsMockCard({
  composerDraft,
  onUseComposerDraft,
  onAnswered,
  onDismiss,
  registerArrowNavigation,
  registerComposerSubmit,
}: AskQuestionsMockCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(() => getInitialAnswers());
  const [dismissed, setDismissed] = useState(false);
  const question = mockQuestions[activeIndex];
  const reviewIndex = mockQuestions.length;
  const onReview = activeIndex === reviewIndex;

  const setQuestionAnswers = (next: string[]) => {
    setAnswers((current) =>
      current.map((answer, index) => (index === activeIndex ? next : answer)),
    );
  };

  const closeMock = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const advance = () => {
    setActiveIndex((index) => Math.min(reviewIndex, index + 1));
  };

  const submitComposerDraft = () => {
    if (onReview) {
      onAnswered?.();
      closeMock();
      return true;
    }

    const value = onUseComposerDraft().trim();
    if (!value) {
      advance();
      return true;
    }
    const current = answers[activeIndex] ?? [];
    setQuestionAnswers(
      question?.multiple ? [...current.filter((item) => item !== value), value] : [value],
    );
    advance();
    return true;
  };

  useEffect(() => {
    registerComposerSubmit?.(submitComposerDraft);
    return () => registerComposerSubmit?.(null);
  });

  useEffect(() => {
    registerArrowNavigation?.((direction) => {
      setActiveIndex((index) => {
        if (direction === "previous") return Math.max(0, index - 1);
        return Math.min(reviewIndex, index + 1);
      });
      return true;
    });
    return () => registerArrowNavigation?.(null);
  }, [registerArrowNavigation, reviewIndex]);

  if (dismissed) {
    return null;
  }

  if (onReview) {
    return (
      <div className="relative -left-1 mx-auto grid h-[186px] w-full max-w-[664px] content-start gap-2 overflow-hidden rounded-t-xl rounded-b-none border border-[color:var(--border)] bg-[#272a39] px-3 py-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2">
          <div className="truncate text-[13px] leading-5 text-[color:var(--text)]">
            Review answers
          </div>

          <div className="flex shrink-0 items-center gap-1 text-[11px] text-[color:var(--muted)]">
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]"
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              aria-label="Previous question"
            >
              &lt;
            </button>
            <span className="min-w-7 text-center tabular-nums">
              {reviewIndex + 1}/{reviewIndex + 1}
            </span>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-35"
              disabled
              aria-label="Next question"
            >
              &gt;
            </button>
          </div>
        </div>

        <div className="grid gap-0.5">
          {mockQuestions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="grid grid-cols-[minmax(0,1fr)] rounded-lg px-2 py-1.5 text-left text-[12px] leading-4 text-[color:var(--muted)] transition-colors hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]"
              onClick={() => setActiveIndex(index)}
            >
              <span className="truncate text-[color:var(--text)]">{item.question}</span>
              <span className="truncate">
                {(answers[index]?.length ?? 0) > 0 ? answers[index].join(", ") : "No answer"}
              </span>
            </button>
          ))}
        </div>

        <div className="h-7" />
      </div>
    );
  }

  if (!question) return null;

  const toggleOption = (label: string) => {
    const current = answers[activeIndex] ?? [];
    if (question.multiple) {
      setQuestionAnswers(
        current.includes(label)
          ? current.filter((answer) => answer !== label)
          : [...current, label],
      );
      return;
    }
    setQuestionAnswers([label]);
  };

  return (
    <div className="relative -left-1 mx-auto grid h-[186px] w-full max-w-[664px] content-start gap-2 overflow-hidden rounded-t-xl rounded-b-none border border-[color:var(--border)] bg-[#272a39] px-3 py-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2">
        <div className="truncate text-[13px] leading-5 text-[color:var(--text)]">
          {question.question}
        </div>

        <div className="flex shrink-0 items-center gap-1 text-[11px] text-[color:var(--muted)]">
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)] disabled:opacity-35"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            aria-label="Previous question"
          >
            &lt;
          </button>
          <span className="min-w-7 text-center tabular-nums">
            {activeIndex + 1}/{reviewIndex + 1}
          </span>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)] disabled:opacity-35"
            onClick={() => setActiveIndex((index) => Math.min(reviewIndex, index + 1))}
            aria-label="Next question"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="grid gap-0.5">
        {[...question.options, { label: "Other" }].map((option) => {
          const isOther = option.label === "Other";
          const picked = isOther
            ? composerDraft.trim().length > 0
            : (answers[activeIndex]?.includes(option.label) ?? false);
          const rowClass = cn(
            "grid grid-cols-[16px_minmax(0,1fr)_auto] gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] leading-4 transition-colors",
            isOther
              ? picked
                ? "text-[color:var(--text)]"
                : "text-[color:var(--muted)] opacity-55"
              : picked
                ? "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]"
                : "text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]",
          );
          const mark = (
            <span
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center self-start",
                isOther
                  ? picked
                    ? "text-[color:var(--accent)]"
                    : "text-transparent"
                  : cn(
                      "border",
                      question.multiple ? "rounded" : "rounded-full",
                      picked
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
                        : "border-[rgba(169,178,215,0.28)] text-transparent",
                    ),
              )}
            >
              <Check size={11} />
            </span>
          );

          if (isOther) {
            return (
              <div key={option.label} className="relative">
                <button type="button" className={rowClass} tabIndex={-1} aria-disabled="true">
                  {mark}
                  <span className="min-w-0 truncate leading-4">{option.label}</span>
                  <span />
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 right-2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[rgba(169,178,215,0.08)] hover:text-[color:var(--text)]"
                  onClick={closeMock}
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={option.label}
              type="button"
              className={rowClass}
              onClick={() => toggleOption(option.label)}
              aria-pressed={picked}
            >
              {mark}
              <span className="min-w-0 truncate leading-4">{option.label}</span>
              <span />
            </button>
          );
        })}
      </div>
    </div>
  );
}
