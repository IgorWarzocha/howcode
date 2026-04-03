import { cn } from "../../utils/cn";

type MessageBubbleProps = {
  role: "assistant" | "user";
  content: string[];
};

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[color:var(--border)] px-4 py-4 shadow-[var(--shadow)]",
        role === "user"
          ? "ml-auto max-w-[72%] bg-[rgba(43,47,62,0.92)]"
          : "max-w-[92%] bg-[rgba(33,36,48,0.78)]",
      )}
    >
      {content.map((paragraph) => (
        <p
          key={`${role}-${paragraph.slice(0, 32)}-${paragraph.length}`}
          className="mb-2.5 whitespace-normal leading-[1.7] text-[color:var(--muted)] last:mb-0"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
