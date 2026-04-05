import { ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  type FeatureStatusId,
  getFeatureStatusButtonClass,
  getFeatureStatusDataAttributes,
} from "../../features/feature-status";
import { hoverSurfaceClass, menuItemClass, transitionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

type MenuItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: string;
  detail?: string;
  caret?: boolean;
  active?: boolean;
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
  type = "button",
  ...buttonProps
}: MenuItemProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        menuItemClass,
        transitionClass,
        hoverSurfaceClass,
        active && "bg-[rgba(183,186,245,0.08)] text-[color:var(--text)]",
        statusId && getFeatureStatusButtonClass(statusId),
      )}
      {...(statusId ? getFeatureStatusDataAttributes(statusId) : {})}
      {...buttonProps}
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
