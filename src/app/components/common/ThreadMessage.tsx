import { ChevronDown, ChevronRight } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import type { Message } from "../../types";
import { inlineCodeClass } from "../../ui/classes";

type ThreadMessageProps = {
  message: Message;
  autoExpandThinking?: boolean;
  onToggleExpanded?: () => void;
};

function renderInline(text: string) {
  let cursor = 0;

  return text.split(/(`[^`]+`)/g).map((part) => {
    const key = `${cursor}-${part}`;
    cursor += part.length;

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className={inlineCodeClass}>
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

function renderProse(content: string[], format: "prose" | "list" = "prose") {
  if (format === "list") {
    return (
      <ul className="m-0 grid list-disc gap-1.5 pl-5 text-[14px] leading-[1.62] text-[color:var(--text)] marker:text-[color:var(--muted)] [overflow-wrap:anywhere]">
        {content.map((item) => (
          <li key={item} className="min-w-0 break-words">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 text-[14px] leading-[1.68] text-[color:var(--text)] [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <p
          key={paragraph}
          className="m-0 whitespace-pre-wrap break-words text-[color:var(--text)]/92 [overflow-wrap:anywhere]"
        >
          {renderInline(paragraph)}
        </p>
      ))}
    </div>
  );
}

function renderThinking(content: string[]) {
  return (
    <div className="grid min-w-0 gap-2 text-[13px] leading-[1.62] text-[color:var(--muted-2)]/92 italic [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <p key={paragraph} className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {renderInline(paragraph)}
        </p>
      ))}
    </div>
  );
}

function AssistantThinkingBlock({
  thinkingContent,
  thinkingRedacted,
  autoExpandThinking = false,
  onToggleExpanded,
}: {
  thinkingContent: string[];
  thinkingRedacted?: boolean;
  autoExpandThinking?: boolean;
  onToggleExpanded?: () => void;
}) {
  const [expanded, setExpanded] = useState(autoExpandThinking);
  const previousAutoExpandRef = useRef(autoExpandThinking);

  useEffect(() => {
    if (autoExpandThinking) {
      setExpanded(true);
    } else if (previousAutoExpandRef.current && !autoExpandThinking) {
      setExpanded(false);
    }

    previousAutoExpandRef.current = autoExpandThinking;
  }, [autoExpandThinking]);

  const label =
    thinkingRedacted && thinkingContent.length === 0 ? "Thinking unavailable" : "Thinking";

  return (
    <div className="mb-3 grid min-w-0 gap-2">
      <button
        type="button"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-[12px] italic text-[color:var(--muted-2)] transition-colors hover:text-[color:var(--muted)]"
        onClick={() => {
          onToggleExpanded?.();
          setExpanded((current) => !current);
        }}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{label}</span>
      </button>

      {expanded ? (
        <div className="min-w-0 border-l border-[rgba(169,178,215,0.12)] pl-4">
          {thinkingContent.length > 0 ? (
            renderThinking(thinkingContent)
          ) : (
            <div className="text-[12px] italic text-[color:var(--muted-2)]/85">
              This provider redacted the reasoning trace.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const ThreadMessage = memo(function ThreadMessage({
  message,
  autoExpandThinking,
  onToggleExpanded,
}: ThreadMessageProps) {
  if (message.role === "user") {
    return (
      <div className="ml-auto min-w-0 max-w-[438px] rounded-[18px] bg-[rgba(47,50,66,0.8)] px-4 py-3 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {message.content.map((paragraph) => (
          <p
            key={paragraph}
            className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            {renderInline(paragraph)}
          </p>
        ))}
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="min-w-0 px-4">
        {message.thinkingContent && message.thinkingContent.length > 0 ? (
          <AssistantThinkingBlock
            thinkingContent={message.thinkingContent}
            thinkingRedacted={message.thinkingRedacted}
            autoExpandThinking={autoExpandThinking}
            onToggleExpanded={onToggleExpanded}
          />
        ) : null}
        {message.content.length > 0 ? renderProse(message.content, message.format) : null}
      </div>
    );
  }

  if (message.role === "toolResult") {
    return (
      <div className="grid min-w-0 gap-2 rounded-[16px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
        <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
          Tool · {message.toolName}
        </div>
        <div
          className={
            message.isError
              ? "min-w-0 text-[13px] text-[#f2a7a7]"
              : "min-w-0 text-[13px] text-[color:var(--text)]/88"
          }
        >
          {renderProse(message.content)}
        </div>
      </div>
    );
  }

  if (message.role === "bashExecution") {
    return (
      <div className="grid min-w-0 gap-2 rounded-[16px] border border-[color:var(--border)] bg-[rgba(17,19,27,0.7)] px-4 py-3 font-mono text-[12px] text-[color:var(--text)]/86">
        <div className="whitespace-pre-wrap break-all text-[color:var(--muted)]">
          $ {message.command}
        </div>
        {message.output.length > 0 ? (
          <div className="grid min-w-0 gap-1 whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
            {message.output.map((line) => (
              <p key={line} className="m-0 min-w-0">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="text-[color:var(--muted)]">No output</div>
        )}
        <div className="text-[color:var(--muted)]">
          exit {message.exitCode ?? "?"}
          {message.cancelled ? " · cancelled" : ""}
          {message.truncated ? " · truncated" : ""}
        </div>
      </div>
    );
  }

  if (message.role === "custom") {
    return (
      <div className="grid min-w-0 gap-2 rounded-[16px] border border-dashed border-[color:var(--border)] px-4 py-3 text-[13px] text-[color:var(--text)]/84">
        <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
          {message.customType}
        </div>
        {renderProse(message.content)}
      </div>
    );
  }

  if (message.role === "branchSummary" || message.role === "compactionSummary") {
    return (
      <div className="grid min-w-0 gap-2 rounded-[16px] border border-[rgba(183,186,245,0.12)] bg-[rgba(183,186,245,0.05)] px-4 py-3 text-[13px] text-[color:var(--text)]/84">
        <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
          {message.role === "branchSummary" ? "Branch summary" : "Compaction summary"}
        </div>
        {renderProse(message.content)}
      </div>
    );
  }

  return null;
});
