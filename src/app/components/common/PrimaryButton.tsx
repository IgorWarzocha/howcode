import { type ButtonHTMLAttributes, type PropsWithChildren, forwardRef } from "react";
import { primaryButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type PrimaryButtonProps = PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    className?: string;
  }
>;

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  function PrimaryButton({ onClick, className, children, type = "button", ...buttonProps }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(primaryButtonClass, className)}
        onClick={onClick}
        {...buttonProps}
      >
        {children}
      </button>
    );
  },
);
