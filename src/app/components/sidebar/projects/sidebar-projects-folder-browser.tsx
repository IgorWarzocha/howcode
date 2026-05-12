import { ChevronLeft, Folder, Home, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DesktopRequestMap } from '../../../../../shared/desktop-ipc'
import { listProjectDirectoryEntriesQuery } from '../../../query/desktop-query'

type ProjectDirectoryState = DesktopRequestMap['listProjectDirectoryEntries']['response']

type SidebarProjectsFolderBrowserProps = {
  busy: boolean
  searchQuery: string
  onAddFolder: (path: string) => void
  onCurrentPathChange: (path: string | null) => void
  onSearchQueryChange: (query: string) => void
}

type DirectoryLoadResult =
  | { state: ProjectDirectoryState; errorMessage: null }
  | { state: null; errorMessage: string }

const pathSegmentSeparatorPattern = /[\\/]/

async function loadDirectory(path?: string | null): Promise<DirectoryLoadResult> {
  try {
    const state = await listProjectDirectoryEntriesQuery(path ? { path } : {})
    if (!state) {
      return { state: null, errorMessage: 'Unable to open folder.' }
    }
    return { state, errorMessage: null }
  } catch (error) {
    return {
      state: null,
      errorMessage: error instanceof Error ? error.message : 'Unable to open folder.',
    }
  }
}

function getPathTail(path: string) {
  return path.split(pathSegmentSeparatorPattern).filter(Boolean).pop() ?? path
}

function compactPath(path: string, homePath?: string) {
  if (homePath && path === homePath) return '~'
  if (homePath && path.startsWith(`${homePath}/`)) return `~/${path.slice(homePath.length + 1)}`
  if (homePath && path.startsWith(`${homePath}\\`)) return `~/${path.slice(homePath.length + 1)}`
  return path
}

export function SidebarProjectsFolderBrowser({
  busy,
  searchQuery,
  onAddFolder,
  onCurrentPathChange,
  onSearchQueryChange,
}: SidebarProjectsFolderBrowserProps) {
  const [state, setState] = useState<ProjectDirectoryState | null>(null)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const loading = Boolean(loadingPath)

  const openDirectory = useCallback(
    async (path?: string | null) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoadingPath(path ?? '__home__')
      setErrorMessage(null)
      const result = await loadDirectory(path)
      if (requestIdRef.current !== requestId) return
      if (result.state) {
        setState(result.state)
        onCurrentPathChange(result.state.currentPath)
      } else {
        setErrorMessage(result.errorMessage)
      }
      setLoadingPath(null)
    },
    [onCurrentPathChange],
  )

  useEffect(() => {
    void openDirectory()
  }, [openDirectory])

  const currentLabel = useMemo(
    () => compactPath(state?.currentPath ?? 'Home', state?.homePath),
    [state?.currentPath, state?.homePath],
  )
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return state?.entries ?? []
    return (state?.entries ?? []).filter((entry) => entry.name.toLowerCase().includes(query))
  }, [searchQuery, state?.entries])

  return (
    <div className="sidebar-project-folder-browser">
      <div className="sidebar-project-folder-header">
        <button
          type="button"
          className="sidebar-project-folder-icon-button"
          onClick={() => void openDirectory(state?.parentPath)}
          disabled={!state?.parentPath || busy || loading}
          aria-label="Go up"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          className="sidebar-project-folder-icon-button"
          onClick={() => void openDirectory(state?.homePath)}
          disabled={!state?.homePath || busy || loading}
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
            disabled={busy || loading}
          >
            <Plus size={13} />
            <span>Initialise project in current folder</span>
          </button>
        ) : null}

        {filteredEntries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="sidebar-project-folder-row"
            onClick={() => void openDirectory(entry.path)}
            disabled={busy || loading}
            title={entry.path}
          >
            <Folder size={13} />
            <span>{entry.name}</span>
          </button>
        ))}

        {!state && loadingPath ? (
          <div className="sidebar-project-folder-empty">Loading…</div>
        ) : null}
        {state && filteredEntries.length === 0 ? (
          <div className="sidebar-project-folder-empty">
            {searchQuery.trim() ? 'No matching folders.' : 'No folders here.'}
          </div>
        ) : null}
      </div>

      <label className="sidebar-project-folder-search">
        <Search size={12} />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="sidebar-project-folder-search-input"
          placeholder="Search current folder"
          aria-label="Search current folder"
          disabled={busy || loading}
        />
      </label>
      {errorMessage ? <div className="sidebar-inline-error">{errorMessage}</div> : null}
    </div>
  )
}

export function getSidebarFolderProjectName(projectPath: string) {
  return getPathTail(projectPath)
}
