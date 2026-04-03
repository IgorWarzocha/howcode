import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type ExpandablePanelProps = {
  expanded: boolean;
  onToggle: () => void;
  panelId: string;
  header: ReactNode;
  children?: ReactNode;
  className?: string;
  triggerClassName?: string;
  bodyClassName?: string;
  ariaLabel?: string;
};

export function ExpandablePanel({
  expanded,
  onToggle,
  panelId,
  header,
  children,
  className,
  triggerClassName,
  bodyClassName,
  ariaLabel,
}: ExpandablePanelProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl", className)}>
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition-colors",
          triggerClassName,
        )}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={ariaLabel}
      >
        <span className="shrink-0 text-[color:var(--muted)]">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        {header}
      </button>

      {expanded ? (
        <div id={panelId} className={cn("border-t px-3 py-3", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
