import { Archive, Settings } from "lucide-react";
import type { RefObject } from "react";
import { MenuItem } from "../../common/MenuItem";
import { HeaderMenu } from "./HeaderMenu";

type ProductMenuProps = {
  menuId: string;
  panelRef: RefObject<HTMLDivElement | null>;
  onOpenArchivedThreads: () => void;
  onOpenSettings: () => void;
};

export function ProductMenu({
  menuId,
  panelRef,
  onOpenArchivedThreads,
  onOpenSettings,
}: ProductMenuProps) {
  return (
    <HeaderMenu ariaLabel="Product menu" menuId={menuId} panelRef={panelRef}>
      <MenuItem
        icon={<Archive size={15} />}
        title="Archived threads"
        onClick={onOpenArchivedThreads}
        role="menuitem"
      />
      <MenuItem
        icon={<Settings size={15} />}
        title="Settings"
        onClick={onOpenSettings}
        role="menuitem"
      />
    </HeaderMenu>
  );
}
