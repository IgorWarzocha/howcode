import type { PropsWithChildren } from "react";
import { ghostButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type TextButtonProps = PropsWithChildren<{
  onClick: () => void;
  className?: string;
}>;

export function TextButton({ onClick, className, children }: TextButtonProps) {
  return (
    <button type="button" className={cn(ghostButtonClass, className)} onClick={onClick}>
      {children}
    </button>
  );
}
