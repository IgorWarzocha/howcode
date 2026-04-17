import type { ButtonHTMLAttributes, ReactNode } from "react";
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
      className={cn("sidebar-nav-button", className)}
      onClick={onClick}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      {...buttonProps}
    >
      {icon}
      <span className="sidebar-nav-button__label">{label}</span>
    </button>
  );
}
