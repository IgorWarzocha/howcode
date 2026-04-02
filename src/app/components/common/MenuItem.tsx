import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  type FeatureStatusId,
  getFeatureStatusButtonClass,
  getFeatureStatusMeta,
} from "../../features/feature-status";
import { hoverSurfaceClass, transitionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

type MenuItemProps = {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: string;
  detail?: string;
  caret?: boolean;
  active?: boolean;
  onClick?: () => void;
  statusId?: FeatureStatusId;
};

export function MenuItem({
  icon,
  title,
  subtitle,
  detail,
  caret,
  active,
  onClick,
  statusId,
}: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-[12px] border border-transparent px-2.5 py-2 text-left text-[14px]",
        transitionClass,
        hoverSurfaceClass,
        active && "bg-[rgba(183,186,245,0.08)] text-[color:var(--text)]",
        statusId && getFeatureStatusButtonClass(statusId),
      )}
      data-feature-id={statusId}
      data-feature-status={statusId ? getFeatureStatusMeta(statusId).status : undefined}
    >
      <span className="text-[color:var(--muted)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 truncate">
          <span className="truncate">{title}</span>
          {statusId ? <FeatureStatusBadge statusId={statusId} /> : null}
        </div>
        {subtitle ? (
          <div className="truncate text-xs text-[color:var(--muted)]">{subtitle}</div>
        ) : null}
      </div>
      {detail ? <span className="ml-auto text-[color:var(--muted)]">{detail}</span> : null}
      {caret ? <ChevronRight size={15} className="ml-auto text-[color:var(--muted)]" /> : null}
    </button>
  );
}
