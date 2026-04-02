import { inlineCodeClass } from "../../ui/classes";

type ThreadMessageProps = {
  role: "assistant" | "user";
  format?: "prose" | "list";
  content: string[];
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

export function ThreadMessage({ role, format = "prose", content }: ThreadMessageProps) {
  if (role === "user") {
    return (
      <div className="ml-auto max-w-[438px] rounded-[18px] bg-[rgba(47,50,66,0.8)] px-4 py-3 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {content.map((paragraph) => (
          <p key={paragraph} className="m-0 whitespace-pre-wrap">
            {renderInline(paragraph)}
          </p>
        ))}
      </div>
    );
  }

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
