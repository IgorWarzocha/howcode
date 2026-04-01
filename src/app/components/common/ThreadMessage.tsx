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
      <div className="ml-auto max-w-[450px] rounded-[18px] bg-[rgba(44,47,62,0.82)] px-4 py-3 text-[15px] leading-7 text-[color:var(--text)]">
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
      <ul className="m-0 grid list-disc gap-2 pl-5 text-[15px] leading-7 text-[color:var(--text)] marker:text-[color:var(--muted)]">
        {content.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-3 text-[15px] leading-8 text-[color:var(--text)]">
      {content.map((paragraph) => (
        <p key={paragraph} className="m-0 whitespace-pre-wrap text-[color:var(--text)]/92">
          {renderInline(paragraph)}
        </p>
      ))}
    </div>
  );
}
