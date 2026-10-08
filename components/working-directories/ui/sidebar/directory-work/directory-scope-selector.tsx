import { useDismissibleLayer } from '@howaboua/howcode-sdk/hooks/useDismissibleLayer'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { IconButton } from '../../../../../src/app/common/icon-button'
import type { AppSettings, DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { SettingsOpenTarget } from '../../../../../src/app/settings/settings/settingsTypes'
import type { WorkingDirectory } from '../../../../../src/app/types'
import { SidebarDirectoriesCreatePopover } from '../directories/sidebar-directories-create-popover'
import { useSidebarDirectoryCreation } from '../directories/useSidebarDirectoryCreation'
import { DirectoryBrandIcon } from './directory-brand-icon'

function DirectoryScopeOptionRow({
  focused,
  directory,
  running,
  visible,
  onToggleVisible,
}: {
  focused: boolean
  directory: WorkingDirectory
  running: boolean
  visible: boolean
  onToggleVisible: () => void
}) {
  return (
    <div
      className="sidebar-compact-row sidebar-compact-row--project-option sidebar-project-work-project-option"
      data-active={focused ? 'true' : 'false'}
    >
      <button
        type="button"
        className="sidebar-project-work-project-scope-toggle"
        data-checked={visible ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          onToggleVisible()
        }}
        aria-label={
          visible ? `Hide ${directory.name} in sidebar` : `Show ${directory.name} in sidebar`
        }
      >
        {visible ? <Check size={11} /> : null}
      </button>
      <button
        type="button"
        className="sidebar-project-work-project-focus"
        onClick={onToggleVisible}
      >
        <DirectoryBrandIcon directory={directory} />
        <span className="truncate">{directory.name}</span>
      </button>
      {running ? (
        <span
          className="sidebar-project-work-live-dot"
          title="Running terminal"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

export function DirectoryScopeSelector({
  appSettings,
  label,
  open,
  directories,
  scopeDirectory,
  selectedDirectory,
  terminalRunningWorkspaceIds,
  visibleDirectories,
  onAction,
  onOpenChange,
  onOpenSettingsPanel,
  onToggleVisibleDirectory,
}: {
  appSettings: AppSettings
  label: string
  open: boolean
  directories: WorkingDirectory[]
  scopeDirectory: WorkingDirectory | null
  selectedDirectory: WorkingDirectory | null
  terminalRunningWorkspaceIds: ReadonlySet<string>
  visibleDirectories: WorkingDirectory[]
  onAction: DesktopActionInvoker
  onOpenChange: (open: boolean) => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onToggleVisibleDirectory: (directoryId: string) => void
}) {
  const selectorRef = useRef<HTMLDivElement | null>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const createPanelRef = useRef<HTMLDialogElement>(null)
  const [directorySearchQuery, setDirectorySearchQuery] = useState('')
  const {
    createBusy,
    createErrorMessage,
    createOpen,
    handleAddFolderDirectory,
    handleCreateDirectory,
    directoryNameDraft,
    setCreateErrorMessage,
    setCreateOpen,
    setDirectoryNameDraft,
  } = useSidebarDirectoryCreation({ appSettings, onAction, onOpenSettingsPanel })
  const normalizedDirectorySearch = directorySearchQuery.trim().toLowerCase()
  const visibleDirectoryIds = useMemo(
    () => new Set(visibleDirectories.map((directory) => directory.id)),
    [visibleDirectories],
  )
  const filteredDirectories = useMemo(() => {
    if (!normalizedDirectorySearch) return directories
    return directories.filter(
      (directory) =>
        directory.name.toLowerCase().includes(normalizedDirectorySearch) ||
        directory.id.toLowerCase().includes(normalizedDirectorySearch),
    )
  }, [normalizedDirectorySearch, directories])

  const closeCreatePopover = () => {
    setCreateOpen(false)
    setCreateErrorMessage(null)
  }
  const dismissSelector = () => {
    closeCreatePopover()
    onOpenChange(false)
  }
  useDismissibleLayer({
    open: open || createOpen,
    onDismiss: dismissSelector,
    refs: [selectorRef, createPanelRef],
    shouldDismissOnEscape: (event) => {
      if (directorySearchQuery.length === 0) return true
      const target = event.target as HTMLElement | null
      if (!target?.closest('.sidebar-project-work-project-search-field')) return true
      event.preventDefault()
      event.stopImmediatePropagation()
      setDirectorySearchQuery('')
      return false
    },
  })

  return (
    <div ref={selectorRef} className="sidebar-project-work-project-card">
      <div className="sidebar-project-work-project-header-row">
        <div className="sidebar-project-work-project-kicker">Workspaces</div>
        <IconButton
          ref={createButtonRef}
          label="Add workspace"
          icon={<Plus size={13} />}
          tooltipPlacement="right"
          className="sidebar-project-work-project-create-button h-7 w-7 -translate-x-px rounded-md"
          onClick={() => {
            if (open) onOpenChange(false)
            setCreateOpen(!createOpen)
          }}
        />
      </div>
      <button
        type="button"
        className="sidebar-project-work-project-button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <span className="sidebar-project-work-project-button-meta">
          {scopeDirectory ? <DirectoryBrandIcon directory={scopeDirectory} /> : null}
          <ChevronDown size={13} />
        </span>
      </button>
      {open ? (
        <div className="sidebar-project-work-project-list">
          <label
            className="sidebar-search-field sidebar-project-work-project-search-field"
            data-active={directorySearchQuery.trim().length > 0 ? 'true' : 'false'}
          >
            <Search size={14} className="sidebar-search-icon" />
            <input
              value={directorySearchQuery}
              onChange={(event) => setDirectorySearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape' || directorySearchQuery.length === 0) return
                event.stopPropagation()
                setDirectorySearchQuery('')
              }}
              placeholder="Search workspaces"
              className="sidebar-search-input"
              aria-label="Search workspaces"
            />
          </label>
          {filteredDirectories.map((directory) => (
            <DirectoryScopeOptionRow
              key={directory.id}
              directory={directory}
              focused={directory.id === selectedDirectory?.id}
              visible={visibleDirectoryIds.has(directory.id)}
              running={terminalRunningWorkspaceIds.has(directory.id)}
              onToggleVisible={() => onToggleVisibleDirectory(directory.id)}
            />
          ))}
          {filteredDirectories.length === 0 ? (
            <div className="sidebar-project-work-project-empty">No matching workspaces</div>
          ) : null}
        </div>
      ) : null}
      <SidebarDirectoriesCreatePopover
        menuId="sidebar-project-work-project-create"
        open={createOpen}
        variant="project-work"
        draft={directoryNameDraft}
        defaultLocation={appSettings.preferredDirectoryLocation ?? null}
        busy={createBusy}
        errorMessage={createErrorMessage}
        panelRef={createPanelRef}
        onChangeDraft={setDirectoryNameDraft}
        onCreate={handleCreateDirectory}
        onAddFolder={handleAddFolderDirectory}
        onClose={closeCreatePopover}
      />
    </div>
  )
}
