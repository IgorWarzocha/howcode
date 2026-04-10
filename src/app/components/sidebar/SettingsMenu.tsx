import { Archive, Clock3, PackagePlus, Settings, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import { popoverPanelClass } from "../../ui/classes";
import { MenuItem } from "../common/MenuItem";
import { SurfacePanel } from "../common/SurfacePanel";

type SettingsMenuProps = {
  menuId: string;
  open: boolean;
  onOpenExtensionsView: () => void;
  onOpenSkillsView: () => void;
  onOpenSettingsPanel: () => void;
  onOpenArchivedThreads: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
};

export function SettingsMenu({
  menuId,
  open,
  onOpenExtensionsView,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  panelRef,
}: SettingsMenuProps) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Settings menu"
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
      className={`motion-popover absolute inset-x-0 bottom-[calc(100%+8px)] z-40 grid max-h-[min(32rem,calc(100vh-7rem))] origin-bottom gap-1 overflow-y-auto rounded-2xl p-2 ${popoverPanelClass}`}
    >
      <MenuItem
        icon={<Sparkles size={15} />}
        title="Skills"
        onClick={onOpenSkillsView}
        role="menuitem"
      />
      <MenuItem
        icon={<PackagePlus size={15} />}
        title="Extensions"
        onClick={onOpenExtensionsView}
        role="menuitem"
      />
      <MenuItem
        icon={<Archive size={15} />}
        title="Archived threads"
        onClick={onOpenArchivedThreads}
        role="menuitem"
      />
      <MenuItem
        icon={<Clock3 size={15} />}
        title="Rate limits remaining"
        caret
        statusId="feature:settings.menu.rate-limits"
        role="menuitem"
      />
      <MenuItem
        icon={<Settings size={15} />}
        title="App settings"
        onClick={onOpenSettingsPanel}
        role="menuitem"
      />
    </SurfacePanel>
  );
}
