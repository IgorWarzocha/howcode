import { Archive, Clock3, PackagePlus, Settings, Sparkles } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import {
  type FeatureStatusId,
  getFeatureStatusDataAttributes,
} from "../../features/feature-status";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
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
  const items: Array<{
    icon: ReactNode;
    title: string;
    onClick?: () => void;
    statusId?: FeatureStatusId;
    disabled?: boolean;
  }> = [
    { icon: <Sparkles size={15} />, title: "Skills", onClick: onOpenSkillsView },
    { icon: <PackagePlus size={15} />, title: "Extensions", onClick: onOpenExtensionsView },
    { icon: <Archive size={15} />, title: "Archived threads", onClick: onOpenArchivedThreads },
    {
      icon: <Clock3 size={15} />,
      title: "Rate limits remaining",
      disabled: true,
      statusId: "feature:settings.menu.rate-limits",
    },
    { icon: <Settings size={15} />, title: "App settings", onClick: onOpenSettingsPanel },
  ];

  return (
    <SurfacePanel
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Settings menu"
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
      className="sidebar-popover-panel sidebar-settings-menu motion-popover"
    >
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          className={cn("sidebar-settings-menu-item", item.disabled && "cursor-not-allowed")}
          onClick={item.onClick}
          disabled={item.disabled}
          data-disabled={item.disabled ? "true" : "false"}
          role="menuitem"
          {...(item.statusId ? getFeatureStatusDataAttributes(item.statusId) : {})}
        >
          <span className="sidebar-settings-menu-item__icon">{item.icon}</span>
          <span className="sidebar-settings-menu-item__label">
            <span className="truncate">{item.title}</span>
            {item.statusId ? <FeatureStatusBadge statusId={item.statusId} /> : null}
          </span>
        </button>
      ))}
    </SurfacePanel>
  );
}
