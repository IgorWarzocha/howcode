import { ChevronDown, ChevronRight } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { disclosureButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type DisclosureSectionProps = PropsWithChildren<{
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
}>;

export function DisclosureSection({
  title,
  open,
  onToggle,
  actions,
  className,
  contentClassName,
  children,
}: DisclosureSectionProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={disclosureButtonClass}
          onClick={onToggle}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{title}</span>
        </button>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {open ? <div className={contentClassName}>{children}</div> : null}
    </div>
  );
}
