import type { Message } from "../../types";
import { inlineCodeClass } from "../../ui/classes";

type ThreadMessageProps = {
  message: Message;
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
      <ul className="m-0 grid list-disc gap-1.5 pl-5 text-[14px] leading-[1.62] text-[color:var(--text)] marker:text-[color:var(--muted)]">
        {content.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-3 text-[14px] leading-[1.68] text-[color:var(--text)]">
      {content.map((paragraph) => (
        <p key={paragraph} className="m-0 whitespace-pre-wrap text-[color:var(--text)]/92">
          {renderInline(paragraph)}
        </p>
      ))}
    </div>
  );
}

export function ThreadMessage({ message }: ThreadMessageProps) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[438px] rounded-[18px] bg-[rgba(47,50,66,0.8)] px-4 py-3 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {message.content.map((paragraph) => (
          <p key={paragraph} className="m-0 whitespace-pre-wrap">
            {renderInline(paragraph)}
          </p>
        ))}
      </div>
    );
  }

  if (message.role === "assistant") {
    return renderProse(message.content, message.format);
  }

  if (message.role === "toolResult") {
    return (
      <div className="grid gap-2 rounded-[16px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
        <div className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          Tool · {message.toolName}
        </div>
        <div
          className={
            message.isError
              ? "text-[13px] text-[#f2a7a7]"
              : "text-[13px] text-[color:var(--text)]/88"
          }
        >
          {renderProse(message.content)}
        </div>
      </div>
    );
  }

  if (message.role === "bashExecution") {
    return (
      <div className="grid gap-2 rounded-[16px] border border-[color:var(--border)] bg-[rgba(17,19,27,0.7)] px-4 py-3 font-mono text-[12px] text-[color:var(--text)]/86">
        <div className="text-[color:var(--muted)]">$ {message.command}</div>
        {message.output.length > 0 ? (
          <div className="grid gap-1 whitespace-pre-wrap">
            {message.output.map((line) => (
              <p key={line} className="m-0">
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
      <div className="grid gap-2 rounded-[16px] border border-dashed border-[color:var(--border)] px-4 py-3 text-[13px] text-[color:var(--text)]/84">
        <div className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          {message.customType}
        </div>
        {renderProse(message.content)}
      </div>
    );
  }

  if (message.role === "branchSummary" || message.role === "compactionSummary") {
    return (
      <div className="grid gap-2 rounded-[16px] border border-[rgba(183,186,245,0.12)] bg-[rgba(183,186,245,0.05)] px-4 py-3 text-[13px] text-[color:var(--text)]/84">
        <div className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          {message.role === "branchSummary" ? "Branch summary" : "Compaction summary"}
        </div>
        {renderProse(message.content)}
      </div>
    );
  }

  return null;
}
