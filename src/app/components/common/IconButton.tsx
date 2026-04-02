import type { ReactNode } from "react";
import { iconButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type IconButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
};

export function IconButton({ label, icon, onClick, active, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        iconButtonClass,
        active &&
          "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.03)]",
        className,
      )}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
