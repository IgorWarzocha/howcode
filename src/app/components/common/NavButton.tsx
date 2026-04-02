import type { ButtonHTMLAttributes, ReactNode } from "react";
import { navButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type NavButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
};

export function NavButton({
  icon,
  label,
  active,
  onClick,
  type = "button",
  className,
  ...buttonProps
}: NavButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        navButtonClass,
        active &&
          "bg-[rgba(183,186,245,0.09)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.03)]",
        className,
      )}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      {...buttonProps}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
