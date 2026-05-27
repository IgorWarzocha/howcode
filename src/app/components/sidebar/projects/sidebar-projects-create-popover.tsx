import { getPopoverRootProps } from '@howcode/common/popover'
import { FolderPlus, Search } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { SidebarProjectsFolderBrowser } from './sidebar-projects-folder-browser'
import { isPathLikeProjectDraft } from './useSidebarProjectCreation'

type SidebarProjectsCreatePopoverProps = {
  menuId: string
  open: boolean
  draft: string
  defaultLocation: string | null
  busy: boolean
  errorMessage: string | null
  variant?: 'legacy' | 'project-work'
  panelRef?: RefObject<HTMLDialogElement | null>
  onChangeDraft: (value: string) => void
  onCreate: (options?: { parentPath?: string | null }) => void
  onAddFolder: (path: string) => void
  onClose: () => void
}

export function SidebarProjectsCreatePopover({
  menuId,
  open,
  draft,
  defaultLocation,
  busy,
  errorMessage,
  variant = 'legacy',
  panelRef,
  onChangeDraft,
  onCreate,
  onAddFolder,
  onClose,
}: SidebarProjectsCreatePopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [browseSearchQuery, setBrowseSearchQuery] = useState('')
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null)
  const [emptyCreateAttempted, setEmptyCreateAttempted] = useState(false)
  const draftIsPathLike = isPathLikeProjectDraft(draft)
  const canSubmit =
    draft.trim().length > 0 &&
    !busy &&
    (draftIsPathLike || Boolean(browseOpen ? currentFolderPath : defaultLocation))
  const missingProjectNameWarning = browseOpen && draft.trim().length === 0 && emptyCreateAttempted

  useEffect(() => {
    if (!open) {
      return
    }

    if (!browseOpen) inputRef.current?.focus()
  }, [browseOpen, open])

  if (!open) {
    return null
  }

  return (
    <dialog
      ref={panelRef}
      id={menuId}
      open
      aria-label="Create project"
      {...getPopoverRootProps(open)}
      data-open={open ? 'true' : 'false'}
      data-variant={variant}
      className="sidebar-popover-panel sidebar-project-create-popover motion-popover"
    >
      <div className="sidebar-project-create-row">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => {
            if (event.target.value.trim().length > 0) setEmptyCreateAttempted(false)
            onChangeDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (canSubmit) {
                onCreate({ parentPath: browseOpen ? currentFolderPath : null })
              }
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
          className="sidebar-project-create-input"
          placeholder={
            missingProjectNameWarning
              ? 'Enter a project name.'
              : 'Project name, path, or GitHub URI'
          }
          aria-label="Project name, path, or GitHub repository URI"
          data-warning={missingProjectNameWarning ? 'true' : 'false'}
        />

        <button
          type="button"
          className="sidebar-project-create-submit sidebar-project-browse-toggle"
          onClick={() => {
            setCurrentFolderPath(null)
            setBrowseOpen((current) => !current)
          }}
          aria-label={browseOpen ? 'Hide folder browser' : 'Browse folders'}
          aria-expanded={browseOpen}
          data-enabled={browseOpen ? 'true' : 'false'}
        >
          <Search size={15} />
        </button>

        <button
          type="button"
          className="sidebar-project-create-submit"
          onClick={() => onCreate({ parentPath: browseOpen ? currentFolderPath : null })}
          disabled={!canSubmit}
          data-enabled={canSubmit ? 'true' : 'false'}
          aria-label={busy ? 'Adding project' : 'Add project'}
          data-tooltip={busy ? 'Adding project' : 'Add project'}
        >
          <FolderPlus size={15} />
        </button>
      </div>
      {browseOpen ? (
        <SidebarProjectsFolderBrowser
          busy={busy}
          projectNameDraft={draft}
          searchQuery={browseSearchQuery}
          onAddFolder={onAddFolder}
          onCreateInCurrentFolder={() => {
            if (draft.trim().length === 0) {
              setEmptyCreateAttempted(true)
              inputRef.current?.focus()
              return
            }
            onCreate({ parentPath: currentFolderPath })
          }}
          onCurrentPathChange={setCurrentFolderPath}
          onSearchQueryChange={setBrowseSearchQuery}
        />
      ) : null}
      {errorMessage ? <div className="sidebar-inline-error">{errorMessage}</div> : null}
    </dialog>
  )
}
