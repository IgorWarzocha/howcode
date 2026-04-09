import type { ReactNode } from "react";
import { viewSubtitleClass, viewTitleClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type ViewHeaderProps = {
  title: ReactNode;
  meta?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ViewHeader({ title, meta, subtitle, actions, className }: ViewHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 grid gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className={viewTitleClass}>{title}</h1>
          {meta}
        </div>
        {subtitle ? <p className={viewSubtitleClass}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
