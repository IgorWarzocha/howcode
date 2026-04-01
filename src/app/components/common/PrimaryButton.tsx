import type { PropsWithChildren } from "react";
import { primaryButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type PrimaryButtonProps = PropsWithChildren<{
  onClick: () => void;
  className?: string;
}>;

export function PrimaryButton({ onClick, className, children }: PrimaryButtonProps) {
  return (
    <button type="button" className={cn(primaryButtonClass, className)} onClick={onClick}>
      {children}
    </button>
  );
}
