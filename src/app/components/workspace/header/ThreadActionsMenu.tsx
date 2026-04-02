import { Archive, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import { HeaderMenu } from "./HeaderMenu";

type ThreadActionsMenuProps = {
  menuId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  onArchiveThread: () => void;
  onDeleteThread: () => void;
};

export function ThreadActionsMenu({
  menuId,
  panelRef,
  onArchiveThread,
  onDeleteThread,
}: ThreadActionsMenuProps) {
  return (
    <HeaderMenu ariaLabel="Thread actions" menuId={menuId} panelRef={panelRef}>
      <button
        type="button"
        role="menuitem"
        className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
        onClick={onArchiveThread}
      >
        <Archive size={14} className="text-[color:var(--muted)]" />
        <span>Archive thread</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-[#ffb4b4] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)]"
        onClick={onDeleteThread}
      >
        <Trash2 size={14} className="text-[color:var(--muted)]" />
        <span>Delete thread</span>
      </button>
    </HeaderMenu>
  );
}
