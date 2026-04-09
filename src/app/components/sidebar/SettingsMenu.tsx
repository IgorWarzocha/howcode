import {
  Archive,
  Clock3,
  Globe,
  LogOut,
  PackagePlus,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
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
      className={`motion-popover fixed bottom-12 left-2.5 z-40 grid w-72 gap-1 rounded-2xl p-2 ${popoverPanelClass}`}
    >
      <div className="flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(183,186,245,0.16)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.08)]">
          <UserRound size={16} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-[color:var(--muted)]">igorwarzocha@gmail.com</div>
          <div className="truncate text-xs text-[color:var(--muted)]">Personal account</div>
        </div>
      </div>
      <div className="mx-2 my-1 h-px bg-[color:var(--border)]" />
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
        icon={<Settings size={15} />}
        title="Settings"
        onClick={onOpenSettingsPanel}
        role="menuitem"
      />
      <MenuItem
        icon={<Archive size={15} />}
        title="Archived threads"
        onClick={onOpenArchivedThreads}
        role="menuitem"
      />
      <MenuItem
        icon={<Globe size={15} />}
        title="Language"
        caret
        statusId="feature:settings.menu.language"
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
        icon={<LogOut size={15} />}
        title="Log out"
        statusId="feature:settings.menu.logout"
        role="menuitem"
      />
    </SurfacePanel>
  );
}
