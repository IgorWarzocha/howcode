import { Bot, Clock3, Globe, LogOut, Settings, UserRound } from "lucide-react";
import { MenuItem } from "../common/MenuItem";
import { SurfacePanel } from "../common/SurfacePanel";

export function SettingsMenu() {
  return (
    <SurfacePanel className="absolute bottom-14 left-2.5 z-10 grid w-[292px] gap-1 border-[color:var(--border-strong)] bg-[rgba(35,39,52,0.98)] p-2">
      <div className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 text-left">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(183,186,245,0.16)] text-[color:var(--accent)]">
          <UserRound size={16} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-[color:var(--text)]">pi@desktop.mock</div>
          <div className="truncate text-xs text-[color:var(--muted)]">Personal account</div>
        </div>
      </div>
      <MenuItem icon={<Settings size={15} />} title="Settings" />
      <MenuItem icon={<Globe size={15} />} title="Language" />
      <MenuItem icon={<Clock3 size={15} />} title="Rate limits remaining" />
      <MenuItem icon={<LogOut size={15} />} title="Log out" />
    </SurfacePanel>
  );
}
