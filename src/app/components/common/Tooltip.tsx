import {
  type PropsWithChildren,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAnimatedPresence } from "../../hooks/useAnimatedPresence";
import { cn } from "../../utils/cn";

type TooltipProps = PropsWithChildren<{
  content: ReactNode;
  placement?: "top" | "right";
  className?: string;
  contentClassName?: string;
}>;

export function Tooltip({
  content,
  placement = "top",
  className,
  contentClassName,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const present = useAnimatedPresence(open, 120);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [positionReady, setPositionReady] = useState(false);

  useLayoutEffect(() => {
    if (!present) {
      setPositionReady(false);
      return;
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportPadding = 12;
      const left =
        placement === "right"
          ? Math.min(window.innerWidth - viewportPadding, rect.right + 10)
          : Math.min(
              window.innerWidth - viewportPadding,
              Math.max(viewportPadding, rect.left + rect.width / 2),
            );

      setPosition({
        left,
        top: placement === "right" ? rect.top + rect.height / 2 : rect.top - 8,
      });
      setPositionReady(true);
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [present, placement]);

  return (
    <span
      ref={anchorRef}
      className={cn("relative inline-flex min-w-0", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {present
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              data-open={open ? "true" : "false"}
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
              className={cn(
                "pointer-events-none fixed z-[120] w-max max-w-[360px] rounded-[10px] border border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] px-2.5 py-1.5 text-[11.5px] leading-4 text-[color:var(--text)] shadow-[0_12px_30px_rgba(0,0,0,0.24)] whitespace-normal break-all transition-[opacity,transform] duration-150 ease-out",
                placement === "right" ? "-translate-y-1/2" : "-translate-x-1/2 -translate-y-full",
                open && positionReady && placement === "right" && "opacity-100 translate-x-[2px]",
                open && positionReady && placement === "top" && "opacity-100 translate-y-[-2px]",
                (!open || !positionReady) &&
                  placement === "right" &&
                  "opacity-0 translate-x-[-4px]",
                (!open || !positionReady) && placement === "top" && "opacity-0 translate-y-[4px]",
                contentClassName,
              )}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
