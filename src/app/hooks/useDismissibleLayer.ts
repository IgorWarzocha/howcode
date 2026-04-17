import { type RefObject, useEffect } from "react";

type DismissibleRef = RefObject<HTMLElement | null>;

type UseDismissibleLayerOptions = {
  open: boolean;
  onDismiss: () => void;
  refs: DismissibleRef[];
};

export function useDismissibleLayer({ open, onDismiss, refs }: UseDismissibleLayerOptions) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const clickedInside = refs.some((ref) => ref.current?.contains(target) ?? false);

      if (!clickedInside) {
        onDismiss();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onDismiss();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onDismiss, open, refs]);
}
