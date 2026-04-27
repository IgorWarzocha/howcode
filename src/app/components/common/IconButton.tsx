import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { iconButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { Tooltip } from "./Tooltip";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
  tooltip?: string | null;
  tooltipPlacement?: "top" | "right";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    tooltip,
    tooltipPlacement,
    onClick,
    active,
    className,
    type = "button",
    ...buttonProps
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
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
      {...buttonProps}
    >
      {icon}
    </button>
  );

  if (tooltip === null) {
    return button;
  }

  return (
    <Tooltip content={tooltip ?? label} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  );
});
