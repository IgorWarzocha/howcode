import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { Archive, Info, Settings, Sparkles } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { FeatureStatusBadge } from '../common/feature-status-badge'
import { PopoverPanel } from '../common/popover'
import { type FeatureStatusId, getFeatureStatusDataAttributes } from '../features/feature-status'
import { cn } from '../utils/cn'

export type AppMenuProps = {
  skillsEnabled?: boolean
  menuId: string
  open: boolean
  onOpenAbout: () => void
  onOpenSkillsView: () => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onOpenArchivedThreads: () => void
  panelRef?: RefObject<HTMLDivElement | null>
}

export function AppMenu({
  skillsEnabled = true,
  menuId,
  open,
  onOpenAbout,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  panelRef,
}: AppMenuProps) {
  const items: Array<{
    icon: ReactNode
    title: string
    onClick?: () => void
    statusId?: FeatureStatusId
    disabled?: boolean
  }> = [
    { icon: <Info size={15} />, title: 'About', onClick: onOpenAbout },
    ...(skillsEnabled
      ? [{ icon: <Sparkles size={15} />, title: 'Skills', onClick: onOpenSkillsView }]
      : []),
    { icon: <Archive size={15} />, title: 'Archived threads', onClick: onOpenArchivedThreads },
    { icon: <Settings size={15} />, title: 'App settings', onClick: onOpenSettingsPanel },
  ]

  return (
    <PopoverPanel
      open={open}
      ref={panelRef}
      id={menuId}
      role="menu"
      aria-label="Settings menu"
      data-open={open ? 'true' : 'false'}
      aria-hidden={!open}
      className="sidebar-popover-panel sidebar-settings-menu motion-popover"
    >
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          className={cn('sidebar-settings-menu-item', item.disabled && 'cursor-not-allowed')}
          onClick={item.onClick}
          disabled={item.disabled}
          data-disabled={item.disabled ? 'true' : 'false'}
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
    </PopoverPanel>
  )
}
