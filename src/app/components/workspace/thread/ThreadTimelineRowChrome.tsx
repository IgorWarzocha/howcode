import { ChevronDown, ChevronRight } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";
import { chatRowShellClass } from "./thread-layout";

const clampOneLineClass =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]";
const clampTwoLinesClass =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
const clampThreeLinesClass =
  "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]";

export function FoldedTimelineRow({
  label,
  secondary,
  singleLine = false,
  italicLabel = false,
  mutedLabel = false,
  trailing,
  onToggle,
}: {
  label: string;
  secondary?: string | null;
  singleLine?: boolean;
  italicLabel?: boolean;
  mutedLabel?: boolean;
  trailing?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="grid w-full min-w-0 gap-1 rounded-xl border border-[rgba(169,178,215,0.08)] bg-[rgba(17,19,27,0.28)] px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
      onClick={onToggle}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`min-w-0 flex-1 text-[13px] font-medium leading-[1.4] ${mutedLabel ? "text-[color:var(--muted-2)]/90" : "text-[color:var(--text)]/92"} ${italicLabel ? "italic" : ""} ${singleLine || secondary || trailing ? clampOneLineClass : clampThreeLinesClass}`}
        >
          {label}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {secondary ? (
        <div
          className={`min-w-0 text-[12px] leading-[1.4] text-[color:var(--muted-2)]/90 ${clampTwoLinesClass}`}
        >
          {secondary}
        </div>
      ) : null}
    </button>
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest('button, a, input, textarea, select, summary, [data-no-row-toggle="true"]'),
  );
}

export function RowLeadToggleSurface({
  onToggle,
  children,
}: {
  onToggle?: () => void;
  children: ReactNode;
}) {
  if (!onToggle) {
    return <>{children}</>;
  }

  return (
    <div
      className="block w-full min-w-0 cursor-pointer text-left"
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event.target)) {
          return;
        }

        onToggle();
      }}
    >
      {children}
    </div>
  );
}

export function TimelineRowShell({
  expanded,
  ariaLabel,
  onToggle,
  toggleClassName,
  children,
}: {
  expanded?: boolean;
  ariaLabel?: string;
  onToggle?: () => void;
  toggleClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={chatRowShellClass} data-row-toggle-anchor={onToggle ? "true" : undefined}>
      {onToggle ? (
        <button
          type="button"
          className={`${toggleClassName ?? "mt-1"} inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]`}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={ariaLabel}
          data-tooltip={ariaLabel}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <div />
      )}
      <div className="min-w-0">{children}</div>
      <div />
    </div>
  );
}
