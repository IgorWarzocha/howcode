import { type ButtonHTMLAttributes, type PropsWithChildren, forwardRef } from "react";
import { ghostButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type TextButtonProps = PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    className?: string;
  }
>;

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton(
  { onClick, className, children, type = "button", title, ...buttonProps },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(ghostButtonClass, className)}
      onClick={onClick}
      data-tooltip={typeof title === "string" ? title : undefined}
      {...buttonProps}
    >
      {children}
    </button>
  );
});
