import { type HTMLAttributes, type PropsWithChildren, forwardRef } from "react";
import { panelChromeClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type SurfacePanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    className?: string;
  }
>;

export const SurfacePanel = forwardRef<HTMLDivElement, SurfacePanelProps>(function SurfacePanel(
  { className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(panelChromeClass, className)} {...props}>
      {children}
    </div>
  );
});
