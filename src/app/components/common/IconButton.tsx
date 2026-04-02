import type { ButtonHTMLAttributes, ReactNode } from "react";
import { iconButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
};

export function IconButton({
  label,
  icon,
  onClick,
  active,
  className,
  type = "button",
  ...buttonProps
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        iconButtonClass,
        active &&
          "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.03)]",
        className,
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      {...buttonProps}
    >
      {icon}
    </button>
  );
}
