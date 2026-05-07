import { Archive, Download, PackagePlus, RotateCw, Settings, Sparkles } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { type FeatureStatusId, getFeatureStatusDataAttributes } from '../../features/feature-status'
import { useAppUpdateFlow } from '../../hooks/useAppUpdateFlow'
import { cn } from '../../utils/cn'
import { FeatureStatusBadge } from '../common/feature-status-badge'
import { SurfacePanel } from '../common/surface-panel'

type SettingsMenuProps = {
  menuId: string
  open: boolean
  onOpenExtensionsView: () => void
  onOpenSkillsView: () => void
  onOpenSettingsPanel: () => void
  onOpenArchivedThreads: () => void
  panelRef?: RefObject<HTMLDivElement | null>
}

export function SettingsMenu({
  menuId,
  open,
  onOpenExtensionsView,
  onOpenSkillsView,
  onOpenSettingsPanel,
  onOpenArchivedThreads,
  panelRef,
}: SettingsMenuProps) {
  const { step, isRunning, advance } = useAppUpdateFlow()
  const updateDisabled = isRunning || step.id === 'up-to-date'
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
    { icon: <Sparkles size={15} />, title: 'Skills', onClick: onOpenSkillsView },
    { icon: <PackagePlus size={15} />, title: 'Extensions', onClick: onOpenExtensionsView },
    { icon: <Archive size={15} />, title: 'Archived threads', onClick: onOpenArchivedThreads },
    { icon: <Settings size={15} />, title: 'App settings', onClick: onOpenSettingsPanel },
  ]

  return (
    <SurfacePanel
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
    </SurfacePanel>
  )
}
