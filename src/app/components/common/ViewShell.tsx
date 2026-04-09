import type { PropsWithChildren } from "react";
import { viewShellClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type ViewShellProps = PropsWithChildren<{
  className?: string;
  maxWidthClassName?: string;
}>;

export function ViewShell({
  children,
  className,
  maxWidthClassName = "max-w-[860px]",
}: ViewShellProps) {
  return <div className={cn(viewShellClass, maxWidthClassName, className)}>{children}</div>;
}
