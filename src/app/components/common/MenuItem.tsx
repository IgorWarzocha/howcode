import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { hoverSurfaceClass, transitionClass } from "../../ui/classes";

type MenuItemProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  detail?: string;
  caret?: boolean;
  active?: boolean;
};

export function MenuItem({ icon, title, subtitle, detail, caret, active }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2.5 rounded-[12px] border border-transparent px-2.5 py-2 text-left text-[14px] ${transitionClass} ${hoverSurfaceClass} ${active ? "bg-[rgba(183,186,245,0.08)] text-[color:var(--text)]" : ""}`}
    >
      <span className="text-[color:var(--muted)]">{icon}</span>
      <div className="min-w-0">
        <div className="truncate">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-[color:var(--muted)]">{subtitle}</div>
        ) : null}
      </div>
      {detail ? <span className="ml-auto text-[color:var(--muted)]">{detail}</span> : null}
      {caret ? <ChevronRight size={15} className="ml-auto text-[color:var(--muted)]" /> : null}
    </button>
  );
}
