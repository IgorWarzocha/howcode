import { FolderPlus } from 'lucide-react'
import { useRef } from 'react'
import { IconButton } from '../../../../../src/app/common/icon-button'
import type { AppSettings, DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import { useDismissibleLayer } from '../../../../../src/app/hooks/useDismissibleLayer'
import type { SettingsOpenTarget } from '../../../../../src/app/settings/settings/settingsTypes'
import { SidebarDirectoriesCreatePopover } from './sidebar-directories-create-popover'
import { useSidebarDirectoryCreation } from './useSidebarDirectoryCreation'

export function WorkspaceFolderCreateButton(props: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDialogElement>(null)
  const creation = useSidebarDirectoryCreation(props)
  const close = () => {
    creation.setCreateOpen(false)
    creation.setCreateErrorMessage(null)
  }
  useDismissibleLayer({
    open: creation.createOpen,
    onDismiss: close,
    refs: [rootRef, panelRef],
  })
  return (
    <div ref={rootRef}>
      <IconButton
        label="Add folder workspace"
        tooltipPlacement="right"
        icon={<FolderPlus size={15} />}
        onClick={() => creation.setCreateOpen(!creation.createOpen)}
      />
      <SidebarDirectoriesCreatePopover
        variant="project-work"
        menuId="workspace-folder-create"
        open={creation.createOpen}
        draft={creation.directoryNameDraft}
        defaultLocation={props.appSettings.preferredDirectoryLocation}
        busy={creation.createBusy}
        errorMessage={creation.createErrorMessage}
        panelRef={panelRef}
        onChangeDraft={creation.setDirectoryNameDraft}
        onCreate={(options) => void creation.handleCreateDirectory(options)}
        onAddFolder={(path) => void creation.handleAddFolderDirectory(path)}
        onClose={close}
      />
    </div>
  )
}
