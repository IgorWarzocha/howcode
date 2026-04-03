import { ChevronDown, ChevronRight } from "lucide-react";
import { memo, useEffect, useId, useRef, useState } from "react";
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
    <div className="grid min-w-0 gap-2 text-[13px] leading-[1.62] text-[color:var(--muted-2)]/78 italic [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <p key={paragraph} className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {renderInline(paragraph)}
        </p>
      ))}
    </div>
  );
}

function getThinkingPreview(thinkingContent: string[], thinkingRedacted?: boolean) {
  if (thinkingContent.length > 0) {
    return thinkingContent[0];
  }

  return thinkingRedacted ? "Reasoning unavailable" : "No reasoning captured";
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
  const panelId = useId();

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
  const preview = getThinkingPreview(thinkingContent, thinkingRedacted);

  return (
    <div className="mb-3 overflow-hidden rounded-[14px] border border-[rgba(169,178,215,0.05)] bg-[rgba(255,255,255,0.012)]">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.015)]"
        onClick={() => {
          onToggleExpanded?.();
          setExpanded((current) => !current);
        }}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className="shrink-0 text-[color:var(--muted)]">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 truncate text-[12.5px] font-medium text-[color:var(--text)]/82">
            {label}
          </span>
          <span className="shrink-0 text-[11px] text-[color:var(--muted-2)]/80">—</span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] italic text-[color:var(--muted-2)]/76">
            {preview}
          </span>
        </span>
      </button>

      {expanded ? (
        <div id={panelId} className="border-t border-[rgba(169,178,215,0.05)] px-3 py-3">
          {thinkingContent.length > 0 ? (
            renderThinking(thinkingContent)
          ) : (
            <div className="text-[12px] italic text-[color:var(--muted-2)]/82">
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
      <div className="w-full min-w-0 rounded-[18px] bg-[rgba(47,50,66,0.58)] px-4 py-3 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
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
      <div className="min-w-0">
        {message.thinkingContent && message.thinkingContent.length > 0 ? (
          <AssistantThinkingBlock
            thinkingContent={message.thinkingContent}
            thinkingRedacted={message.thinkingRedacted}
            autoExpandThinking={autoExpandThinking}
            onToggleExpanded={onToggleExpanded}
          />
        ) : null}
        {message.content.length > 0 ? (
          <div className="px-4">{renderProse(message.content, message.format)}</div>
        ) : null}
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
