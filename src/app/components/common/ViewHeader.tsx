import { X } from "lucide-react";
import type { ReactNode } from "react";
import { ghostButtonClass, viewSubtitleClass, viewTitleClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type ViewHeaderProps = {
  title: ReactNode;
  meta?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
};

export function ViewHeader({
  title,
  meta,
  subtitle,
  actions,
  onClose,
  closeLabel = "Close view",
  className,
}: ViewHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 grid gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className={viewTitleClass}>{title}</h1>
          {meta}
        </div>
        {subtitle ? <p className={viewSubtitleClass}>{subtitle}</p> : null}
      </div>
      {actions || onClose ? (
        <div className="flex shrink-0 items-center gap-2">
          {actions ? <div className="shrink-0">{actions}</div> : null}
          {onClose ? (
            <button
              type="button"
              className={cn(
                ghostButtonClass,
                "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-[color:var(--text)]",
              )}
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={14} />
              <span>Close</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
