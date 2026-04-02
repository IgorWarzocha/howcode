import { useRef } from "react";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";

export function useProjectMenuDismiss(open: boolean, onDismiss: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({
    open,
    onDismiss,
    refs: [containerRef],
  });

  return {
    containerRef,
  };
}
