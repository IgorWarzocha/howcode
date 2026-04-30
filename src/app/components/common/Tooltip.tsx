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
      className={cn("tooltip-anchor", className)}
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
              data-placement={placement}
              data-ready={positionReady ? "true" : "false"}
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
              className={cn("tooltip-content", contentClassName)}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
