import { type RefObject, useLayoutEffect, useState } from "react";

export function useWorkspaceFooterHeight({
  footerRef,
  visible,
}: {
  footerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  const [footerHeight, setFooterHeight] = useState(0);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!visible || !footer) {
      setFooterHeight(0);
      return;
    }

    const updateFooterHeight = () => {
      const nextHeight = Math.ceil(footer.getBoundingClientRect().height);
      setFooterHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateFooterHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateFooterHeight();
    });
    observer.observe(footer);

    return () => {
      observer.disconnect();
    };
  }, [footerRef, visible]);

  return footerHeight;
}
