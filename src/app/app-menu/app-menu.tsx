import { Archive, Download, Info, PackagePlus, RotateCw, Settings, Sparkles } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { FeatureStatusBadge } from '../components/common/feature-status-badge'
import { PopoverPanel } from '../components/common/popover'
import { type FeatureStatusId, getFeatureStatusDataAttributes } from '../features/feature-status'
import { useAppUpdateFlow } from '../hooks/useAppUpdateFlow'
import { cn } from '../utils/cn'
import type { SettingsOpenTarget } from '../views/settings/settingsTypes'

export type AppMenuProps = {
  menuId: string
  open: boolean
  onOpenExtensionsView: () => void
  onOpenAbout: () => void
  onOpenSkillsView: () => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onOpenArchivedThreads: () => void
  panelRef?: RefObject<HTMLDivElement | null>
}

export function AppMenu({
  menuId,
  open,
  onOpenExtensionsView,
  onOpenAbout,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  panelRef,
}: AppMenuProps) {
  const { step, isRunning, advance } = useAppUpdateFlow()
  const updateDisabled = isRunning
  const UpdateIcon =
    step.id === 'idle' ||
    step.id === 'up-to-date' ||
    step.id === 'checking' ||
    step.id === 'error' ||
    step.id === 'ready' ||
    step.id === 'restarting' ||
    step.id === 'installing'
      ? RotateCw
      : Download
  const items: Array<{
    icon: ReactNode
    title: string
    onClick?: () => void
    statusId?: FeatureStatusId
    disabled?: boolean
  }> = [
    { icon: <Info size={15} />, title: 'About', onClick: onOpenAbout },
    { icon: <Sparkles size={15} />, title: 'Skills', onClick: onOpenSkillsView },
    { icon: <PackagePlus size={15} />, title: 'Extensions', onClick: onOpenExtensionsView },
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
      <button
        type="button"
        className={cn('sidebar-settings-menu-item', updateDisabled && 'cursor-not-allowed')}
        onClick={advance}
        disabled={updateDisabled}
        data-disabled={updateDisabled ? 'true' : 'false'}
        role="menuitem"
      >
        <span className="sidebar-settings-menu-item__icon">
          <UpdateIcon size={15} className={cn(isRunning && 'animate-spin')} />
        </span>
        <span className="sidebar-settings-menu-item__label">
          <span className="truncate">{step.label}</span>
        </span>
      </button>
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
