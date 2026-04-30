import { Bot, Brain, Gauge, Server } from "lucide-react";
import { cn } from "../../utils/cn";

type DesktopComposerStatusMockProps = {
  className?: string;
};

const statusLineClass =
  "flex min-w-0 items-center gap-1.5 truncate text-[11px] leading-4 text-[color:var(--muted)]";

const iconClass = "shrink-0 text-[rgba(169,178,215,0.58)]";

const rows = [
  { icon: Server, label: "Anthropic" },
  { icon: Bot, label: "Sonnet 4.5", highlight: true },
  { icon: Brain, label: "High" },
  { icon: Gauge, label: "42%" },
];

export function DesktopComposerStatusMock({ className }: DesktopComposerStatusMockProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto grid w-36 select-none gap-0.5 rounded-xl px-1.5 py-1 text-left opacity-70 transition-opacity hover:opacity-100",
        className,
      )}
      aria-label="Composer status preview"
    >
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.label} className={statusLineClass}>
            <Icon size={11} className={iconClass} />
            <span className={cn("truncate", row.highlight && "text-[color:var(--text)]")}>
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
