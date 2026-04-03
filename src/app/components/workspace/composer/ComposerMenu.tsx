import { Check } from "lucide-react";
import type { RefObject } from "react";
import { menuOptionClass, popoverPanelClass } from "../../../ui/classes";
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
      className={`absolute bottom-[calc(100%+8px)] left-0 z-30 grid rounded-2xl border-[color:var(--border-strong)] bg-[rgba(39,42,57,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${popoverPanelClass} ${widthClassName}`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitemradio"
          aria-checked={item.selected}
          className={`${menuOptionClass} text-[color:var(--text)]`}
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
