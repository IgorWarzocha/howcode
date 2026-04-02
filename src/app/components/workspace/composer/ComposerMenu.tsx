import { Check } from "lucide-react";
import type { RefObject } from "react";
import { SurfacePanel } from "../../common/SurfacePanel";

type ComposerMenuItem = {
  description?: string;
  id: string;
  label: string;
  selected: boolean;
};

type ComposerMenuProps = {
  items: ComposerMenuItem[];
  menuId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  widthClassName: string;
};

export function ComposerMenu({
  items,
  menuId,
  panelRef,
  onSelect,
  widthClassName,
}: ComposerMenuProps) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      className={`absolute bottom-[calc(100%+8px)] left-0 z-30 grid rounded-[16px] border-[color:var(--border-strong)] bg-[rgba(39,42,57,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${widthClassName}`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitemradio"
          aria-checked={item.selected}
          className="grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] hover:bg-[rgba(255,255,255,0.04)]"
          onClick={() => onSelect(item.id)}
        >
          <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
            {item.selected ? <Check size={14} /> : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate">{item.label}</span>
            {item.description ? (
              <span className="block truncate text-[11px] text-[color:var(--muted)]">
                {item.description}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </SurfacePanel>
  );
}
