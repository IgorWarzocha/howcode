import type { ReactNode } from "react";
import { hoverSurfaceClass, transitionClass } from "../../ui/classes";

type MenuItemProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
};

export function MenuItem({ icon, title, subtitle }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2.5 rounded-[12px] border border-transparent px-2.5 py-2.5 text-left ${transitionClass} ${hoverSurfaceClass}`}
    >
      {icon}
      <div className="min-w-0">
        <div className="truncate">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-[color:var(--muted)]">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}
