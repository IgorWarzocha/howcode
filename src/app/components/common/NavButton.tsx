import type { ReactNode } from "react";
import { navButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type NavButtonProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
};

export function NavButton({ icon, label, active, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      className={cn(navButtonClass, active && "bg-[var(--accent-soft)] text-[color:var(--text)]")}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
