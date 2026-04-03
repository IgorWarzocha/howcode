import { useState } from "react";
import type { Message } from "../../../types";
import { getToolCallPreview, getToolCallTitle } from "../../../utils/thread-previews";
import { ExpandablePanel } from "../../common/ExpandablePanel";

type ToolCallMessage = Extract<Message, { role: "toolResult" | "bashExecution" }>;

type ToolCallsCardProps = {
  messages: ToolCallMessage[];
  onToggleExpanded?: () => void;
};

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

export function ToolCallsCard({ messages, onToggleExpanded }: ToolCallsCardProps) {
  const [expandedToolCallIds, setExpandedToolCallIds] = useState<Record<string, boolean>>({});

  return (
    <div className="grid min-w-0 gap-2">
      {messages.map((message) => {
        const expanded = expandedToolCallIds[message.id] ?? false;
        const title = getToolCallTitle(message);
        const preview = getToolCallPreview(message);
        const isError = message.role === "toolResult" && message.isError;

        return (
          <ExpandablePanel
            key={message.id}
            expanded={expanded}
            onToggle={() => {
              onToggleExpanded?.();
              setExpandedToolCallIds((current) => ({
                ...current,
                [message.id]: !expanded,
              }));
            }}
            panelId={`tool-call-panel-${message.id}`}
            className="border border-[rgba(169,178,215,0.08)] bg-[rgba(17,19,27,0.28)]"
            triggerClassName="hover:bg-[rgba(255,255,255,0.025)]"
            bodyClassName="border-[rgba(169,178,215,0.08)]"
            header={
              <>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                  <span className="shrink-0 truncate text-[12.5px] leading-[1.2] font-medium text-[color:var(--text)]/92">
                    {title}
                  </span>
                  <span className="shrink-0 text-[11px] leading-[1.2] text-[color:var(--muted-2)]/80">
                    —
                  </span>
                  <span
                    className={
                      message.role === "bashExecution"
                        ? "min-w-0 flex-1 truncate font-mono text-[11.5px] leading-[1.2] text-[color:var(--muted-2)]/90"
                        : "min-w-0 flex-1 truncate text-[11.5px] leading-[1.2] text-[color:var(--muted-2)]/90"
                    }
                  >
                    {preview}
                  </span>
                </span>
                {isError ? (
                  <span className="shrink-0 text-[10.5px] font-medium text-[#f2a7a7]">Error</span>
                ) : null}
              </>
            }
          >
            {renderToolCallBody(message)}
          </ExpandablePanel>
        );
      })}
    </div>
  );
}
