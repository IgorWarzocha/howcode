import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { toolbarButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type ToolbarButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: ReactNode;
  icon: ReactNode;
  trailing?: boolean;
};

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    { label, icon, onClick, trailing, className, type = "button", ...buttonProps },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(toolbarButtonClass, className)}
        onClick={onClick}
        {...buttonProps}
      >
        {!trailing ? icon : null}
        <span>{label}</span>
        {trailing ? icon : null}
      </button>
    );
  },
);
