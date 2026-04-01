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
      className={cn(
        navButtonClass,
        active &&
          "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.03)]",
      )}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
