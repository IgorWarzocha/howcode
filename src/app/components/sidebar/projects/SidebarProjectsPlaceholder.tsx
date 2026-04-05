import { Code2 } from "lucide-react";
import { compactCardClass } from "../../../ui/classes";

export function SidebarProjectsPlaceholder() {
  return (
    <div
      className={`${compactCardClass} grid min-h-24 place-items-center gap-1.5 px-3 py-3 text-center text-[12.5px] text-[color:var(--muted)]`}
    >
      <Code2 size={15} className="text-[color:var(--muted-2)]" />
      <span>Projects live in Code</span>
    </div>
  );
}
