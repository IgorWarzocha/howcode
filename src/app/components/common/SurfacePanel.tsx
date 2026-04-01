import type { PropsWithChildren } from "react";
import { panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type SurfacePanelProps = PropsWithChildren<{
  className?: string;
}>;

export function SurfacePanel({ className, children }: SurfacePanelProps) {
  return <div className={cn(panelChromeClass, className)}>{children}</div>;
}
