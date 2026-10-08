import { FolderPlus } from 'lucide-react'
import { useRef } from 'react'
import { IconButton } from '../../../../../src/app/common/icon-button'
import type { AppSettings, DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import { useDismissibleLayer } from '../../../../../src/app/hooks/useDismissibleLayer'
import type { SettingsOpenTarget } from '../../../../../src/app/settings/settings/settingsTypes'
import { SidebarProjectsCreatePopover } from './sidebar-projects-create-popover'
import { useSidebarProjectCreation } from './useSidebarProjectCreation'

export function WorkspaceFolderCreateButton(props: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDialogElement>(null)
  const creation = useSidebarProjectCreation(props)
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
      <SidebarProjectsCreatePopover
        variant="project-work"
        menuId="workspace-folder-create"
        open={creation.createOpen}
        draft={creation.projectNameDraft}
        defaultLocation={props.appSettings.preferredProjectLocation}
        busy={creation.createBusy}
        errorMessage={creation.createErrorMessage}
        panelRef={panelRef}
        onChangeDraft={creation.setProjectNameDraft}
        onCreate={(options) => void creation.handleCreateProject(options)}
        onAddFolder={(path) => void creation.handleAddFolderProject(path)}
        onClose={close}
      />
    </div>
  )
}
