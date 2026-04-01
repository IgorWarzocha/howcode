import type { ReactNode } from "react";
import { iconButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type IconButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
};

export function IconButton({ label, icon, onClick, active }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(iconButtonClass, active && "bg-[var(--accent-soft)] text-[color:var(--text)]")}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
