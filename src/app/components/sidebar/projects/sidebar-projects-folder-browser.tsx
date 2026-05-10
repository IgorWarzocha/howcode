import { ChevronLeft, Folder, FolderPlus, Home, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DesktopRequestMap } from '../../../../../shared/desktop-ipc'
import { listProjectDirectoryEntriesQuery } from '../../../query/desktop-query'

type ProjectDirectoryState = DesktopRequestMap['listProjectDirectoryEntries']['response']

type SidebarProjectsFolderBrowserProps = {
  busy: boolean
  onAddFolder: (path: string) => void
  onCreateFolder: (parentPath: string, folderName: string) => void
}

const pathSegmentSeparatorPattern = /[\\/]/

function getPathTail(path: string) {
  return path.split(pathSegmentSeparatorPattern).filter(Boolean).pop() ?? path
}

function compactPath(path: string, homePath?: string) {
  if (homePath && path === homePath) return '~'
  if (homePath && path.startsWith(`${homePath}/`)) return `~/${path.slice(homePath.length + 1)}`
  return path
}

export function SidebarProjectsFolderBrowser({
  busy,
  onAddFolder,
  onCreateFolder,
}: SidebarProjectsFolderBrowserProps) {
  const [state, setState] = useState<ProjectDirectoryState | null>(null)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [folderNameDraft, setFolderNameDraft] = useState('')

  const openDirectory = useCallback(async (path?: string | null) => {
    setLoadingPath(path ?? '__home__')
    setErrorMessage(null)
    try {
      const nextState = await listProjectDirectoryEntriesQuery(path ? { path } : {})
      setState(nextState)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open folder.')
    } finally {
      setLoadingPath(null)
    }
  }, [])

  useEffect(() => {
    void openDirectory()
  }, [openDirectory])

  const trimmedFolderName = folderNameDraft.trim()
  const canCreate = trimmedFolderName.length > 0 && Boolean(state?.currentPath) && !busy
  const currentLabel = useMemo(
    () => compactPath(state?.currentPath ?? 'Home', state?.homePath),
    [state?.currentPath, state?.homePath],
  )

  return (
    <div className="sidebar-project-folder-browser">
      <div className="sidebar-project-folder-header">
        <button
          type="button"
          className="sidebar-project-folder-icon-button"
          onClick={() => void openDirectory(state?.parentPath)}
          disabled={!state?.parentPath || busy}
          aria-label="Go up"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          className="sidebar-project-folder-icon-button"
          onClick={() => void openDirectory(state?.homePath)}
          disabled={!state?.homePath || busy}
          aria-label="Go home"
        >
          <Home size={13} />
        </button>
        <div className="sidebar-project-folder-path" title={state?.currentPath ?? undefined}>
          {currentLabel}
        </div>
      </div>

      <div className="sidebar-project-folder-list" aria-busy={loadingPath ? 'true' : 'false'}>
        {state ? (
          <button
            type="button"
            className="sidebar-project-folder-row sidebar-project-folder-row--add"
            onClick={() => onAddFolder(state.currentPath)}
            disabled={busy}
          >
            <Plus size={13} />
            <span>Add this folder</span>
          </button>
        ) : null}

        {state?.entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="sidebar-project-folder-row"
            onClick={() => void openDirectory(entry.path)}
            disabled={busy}
            title={entry.path}
          >
            <Folder size={13} />
            <span>{entry.name}</span>
          </button>
        ))}

        {!state && loadingPath ? (
          <div className="sidebar-project-folder-empty">Loading…</div>
        ) : null}
        {state && state.entries.length === 0 ? (
          <div className="sidebar-project-folder-empty">No folders here.</div>
        ) : null}
      </div>

      <div className="sidebar-project-create-row">
        <input
          value={folderNameDraft}
          onChange={(event) => setFolderNameDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canCreate && state) {
              event.preventDefault()
              onCreateFolder(state.currentPath, trimmedFolderName)
              setFolderNameDraft('')
            }
          }}
          className="sidebar-project-create-input"
          placeholder="New folder name"
          aria-label="New folder name"
          disabled={busy}
        />
        <button
          type="button"
          className="sidebar-project-create-submit"
          onClick={() => {
            if (state && canCreate) {
              onCreateFolder(state.currentPath, trimmedFolderName)
              setFolderNameDraft('')
            }
          }}
          disabled={!canCreate}
          data-enabled={canCreate ? 'true' : 'false'}
          aria-label="Create folder and add project"
        >
          <FolderPlus size={15} />
        </button>
      </div>
      {errorMessage ? <div className="sidebar-inline-error">{errorMessage}</div> : null}
    </div>
  )
}

export function getSidebarFolderProjectName(projectPath: string) {
  return getPathTail(projectPath)
}
