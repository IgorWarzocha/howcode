import { Archive, Clock3, Globe, LogOut, Settings, UserRound } from "lucide-react";
import type { RefObject } from "react";
import { MenuItem } from "../common/MenuItem";
import { SurfacePanel } from "../common/SurfacePanel";

type SettingsMenuProps = {
  menuId: string;
  onOpenArchivedThreads: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
};

export function SettingsMenu({ menuId, onOpenArchivedThreads, panelRef }: SettingsMenuProps) {
  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Settings menu"
      className="fixed bottom-12 left-2.5 z-40 grid w-[280px] gap-1 border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
    >
      <div className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 text-left">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(183,186,245,0.16)] text-[color:var(--accent)]">
          <UserRound size={16} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-[color:var(--muted)]">igorwarzocha@gmail.com</div>
          <div className="truncate text-xs text-[color:var(--muted)]">Personal account</div>
        </div>
      </div>
      <div className="mx-2 my-1 h-px bg-[color:var(--border)]" />
      <MenuItem
        icon={<Settings size={15} />}
        title="Settings"
        active
        statusId="feature:settings.menu.settings"
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
