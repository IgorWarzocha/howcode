import { ChevronDown, ChevronRight, SquareTerminal, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import type { Message } from "../../../types";

type ToolCallMessage = Extract<Message, { role: "toolResult" | "bashExecution" }>;

type ToolCallsCardProps = {
  messages: ToolCallMessage[];
};

function getToolCallTitle(message: ToolCallMessage) {
  if (message.role === "toolResult") {
    return message.toolName;
  }

  return "Shell";
}

function getToolCallPreview(message: ToolCallMessage) {
  if (message.role === "toolResult") {
    return message.content[0] ?? (message.isError ? "Tool failed." : "Tool finished.");
  }

  return message.command || "No command";
}

function renderToolCallBody(message: ToolCallMessage) {
  if (message.role === "toolResult") {
    return (
      <div
        className={
          message.isError
            ? "grid min-w-0 gap-2 text-[13px] text-[#f2a7a7]"
            : "grid min-w-0 gap-2 text-[13px] text-[color:var(--text)]/88"
        }
      >
        {message.content.map((paragraph) => (
          <p
            key={paragraph}
            className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-2 font-mono text-[12px] text-[color:var(--text)]/86">
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

export function ToolCallsCard({ messages }: ToolCallsCardProps) {
  const [expandedToolCallIds, setExpandedToolCallIds] = useState<Record<string, boolean>>({});
  const orderedMessages = useMemo(() => messages, [messages]);

  return (
    <div className="grid min-w-0 gap-2 rounded-[16px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
      <div className="px-1 text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        Tool calls · {orderedMessages.length}
      </div>

      <div className="grid min-w-0 gap-2">
        {orderedMessages.map((message) => {
          const expanded = expandedToolCallIds[message.id] ?? false;
          const title = getToolCallTitle(message);
          const preview = getToolCallPreview(message);
          const isError = message.role === "toolResult" && message.isError;

          return (
            <div
              key={message.id}
              className="overflow-hidden rounded-[14px] border border-[rgba(169,178,215,0.08)] bg-[rgba(17,19,27,0.28)]"
            >
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                onClick={() =>
                  setExpandedToolCallIds((current) => ({
                    ...current,
                    [message.id]: !expanded,
                  }))
                }
                aria-expanded={expanded}
                aria-controls={`tool-call-panel-${message.id}`}
              >
                <span className="shrink-0 text-[color:var(--muted)]">
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
                <span className="shrink-0 text-[color:var(--muted)]">
                  {message.role === "toolResult" ? (
                    <Wrench size={14} />
                  ) : (
                    <SquareTerminal size={14} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[color:var(--text)]">
                    {title}
                  </span>
                  <span className="block truncate text-[12px] text-[color:var(--muted)]">
                    {preview}
                  </span>
                </span>
                <span
                  className={
                    isError
                      ? "shrink-0 text-[11px] font-medium text-[#f2a7a7]"
                      : "shrink-0 text-[11px] text-[color:var(--muted)]"
                  }
                >
                  {isError ? "Error" : "Done"}
                </span>
              </button>

              {expanded ? (
                <div
                  id={`tool-call-panel-${message.id}`}
                  className="border-t border-[rgba(169,178,215,0.08)] px-3 py-3"
                >
                  {renderToolCallBody(message)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
