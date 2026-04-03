import { memo, useEffect, useId, useRef, useState } from "react";
import type { Message } from "../../types";
import { getThinkingPreview } from "../../utils/thread-previews";
import { ExpandablePanel } from "./ExpandablePanel";
import { MarkdownContent } from "./MarkdownContent";

type ThreadMessageProps = {
  message: Message;
  autoExpandThinking?: boolean;
  onToggleExpanded?: () => void;
};

function renderProse(content: string[], format: "prose" | "list" = "prose") {
  if (format === "list") {
    return (
      <MarkdownContent
        markdown={content.map((item) => `- ${item}`).join("\n")}
        className="gap-1.5"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-3 [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <MarkdownContent key={paragraph} markdown={paragraph} />
      ))}
    </div>
  );
}

function renderThinking(content: string[]) {
  return (
    <div className="grid min-w-0 gap-2 [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <MarkdownContent
          key={paragraph}
          markdown={paragraph}
          tone="thinking"
          className="gap-1 text-[13px] leading-[1.62]"
        />
      ))}
    </div>
  );
}

function AssistantThinkingBlock({
  thinkingContent,
  thinkingHeaders,
  thinkingRedacted,
  autoExpandThinking = false,
  onToggleExpanded,
}: {
  thinkingContent: string[];
  thinkingHeaders?: string[];
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
  const preview =
    thinkingHeaders && thinkingHeaders.length > 0
      ? thinkingHeaders.join(", ")
      : getThinkingPreview(thinkingContent, thinkingRedacted);

  return (
    <ExpandablePanel
      expanded={expanded}
      onToggle={() => {
        onToggleExpanded?.();
        setExpanded((current) => !current);
      }}
      panelId={panelId}
      className="mb-3 border border-[rgba(169,178,215,0.05)] bg-[rgba(255,255,255,0.012)]"
      triggerClassName="hover:bg-[rgba(255,255,255,0.015)]"
      bodyClassName="border-[rgba(169,178,215,0.05)]"
      header={
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 truncate text-[12.5px] font-medium text-[color:var(--text)]/82">
            {label}
          </span>
          <span className="shrink-0 text-[11px] text-[color:var(--muted-2)]/80">—</span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] italic text-[color:var(--muted-2)]/76">
            {preview}
          </span>
        </span>
      }
    >
      {thinkingContent.length > 0 ? (
        renderThinking(thinkingContent)
      ) : (
        <div className="text-[12px] italic text-[color:var(--muted-2)]/82">
          This provider redacted the reasoning trace.
        </div>
      )}
    </ExpandablePanel>
  );
}

function SummaryBlock({
  label,
  content,
}: {
  label: string;
  content: string[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(169,178,215,0.06)] bg-[rgba(255,255,255,0.018)]">
      <div className="border-b border-[rgba(169,178,215,0.05)] px-3 py-2 text-[12.5px] font-medium text-[color:var(--text)]/82">
        {label}
      </div>
      <div className="px-3 py-3">{renderThinking(content)}</div>
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
      <div className="w-full min-w-0 rounded-2xl bg-[rgba(47,50,66,0.58)] px-4 py-3 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="grid min-w-0 gap-3 [overflow-wrap:anywhere]">
          {message.content.map((paragraph) => (
            <MarkdownContent
              key={paragraph}
              markdown={paragraph}
              tone="user"
              className="text-[14px] leading-[1.58]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    return (
      <div className="min-w-0">
        {message.thinkingContent && message.thinkingContent.length > 0 ? (
          <AssistantThinkingBlock
            thinkingContent={message.thinkingContent}
            thinkingHeaders={message.thinkingHeaders}
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
      <div className="grid min-w-0 gap-2 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
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
      <div className="grid min-w-0 gap-2 rounded-2xl border border-[color:var(--border)] bg-[rgba(17,19,27,0.7)] px-4 py-3 font-mono text-[12px] text-[color:var(--text)]/86">
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
      <div className="grid min-w-0 gap-2 rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-3 text-[13px] text-[color:var(--text)]/84">
        <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
          {message.customType}
        </div>
        {renderProse(message.content)}
      </div>
    );
  }

  if (message.role === "branchSummary" || message.role === "compactionSummary") {
    const label = message.role === "branchSummary" ? "Branch summary" : "Compaction summary";

    return (
      <div className="px-4">
        <SummaryBlock label={label} content={message.content} />
      </div>
    );
  }

  return null;
});
