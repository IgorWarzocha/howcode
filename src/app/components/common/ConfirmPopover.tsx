import type { RefObject } from "react";
import { useRef } from "react";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import { confirmPopoverClass, popoverPanelClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { SurfacePanel } from "./SurfacePanel";

type ConfirmPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
};

export function ConfirmPopover({
  open,
  anchorRef,
  onClose,
  onConfirm,
  confirmLabel = "Yes",
  cancelLabel = "No",
  className,
}: ConfirmPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({
    open,
    onDismiss: onClose,
    refs: [anchorRef, panelRef],
  });

  if (!open) {
    return null;
  }

  return (
    <SurfacePanel
      ref={panelRef}
      className={cn(confirmPopoverClass, popoverPanelClass, className)}
      data-open="true"
    >
      <button
        type="button"
        className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-[#ffb4b4] transition-colors hover:bg-[rgba(255,120,120,0.14)]"
        onClick={() => void onConfirm()}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        className="rounded-md px-1.5 py-0.5 text-[10.5px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
        onClick={onClose}
      >
        {cancelLabel}
      </button>
    </SurfacePanel>
  );
}
