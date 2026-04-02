import type { PropsWithChildren, RefObject } from "react";
import { SurfacePanel } from "../../common/SurfacePanel";

type HeaderMenuProps = PropsWithChildren<{
  ariaLabel: string;
  menuId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  className?: string;
}>;

export function HeaderMenu({ ariaLabel, children, className, menuId, panelRef }: HeaderMenuProps) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label={ariaLabel}
      className={
        className ??
        "absolute top-[calc(100%+8px)] right-0 z-40 grid min-w-[220px] gap-1 rounded-[14px] border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
      }
    >
      {children}
    </SurfacePanel>
  );
}
