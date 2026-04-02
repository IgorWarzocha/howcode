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
        onDismiss();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss, open, refs]);
}
