import { useEffect, useMemo, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { View, WorkingDirectory } from '../../../../../src/app/types'
import {
  filterVisibleDirectoryIds,
  getDirectoryScopeLabel,
  getDisplayableDirectories,
  getDisplayableWorkspaces,
  getSelectedDirectoryForScope,
  getVisibleDirectoryIds,
  orderDirectoriesForScopeSelector,
  toggleVisibleDirectoryId,
} from './directory-scope-model'

export function useDirectoryScopeController({
  initialVisibleDirectoryIds,
  directories,
  directoryTargetMode,
  selectedDirectoryId,
  onAction,
  onDirectoryPrimeSelection,
  onDirectorySelect,
  onShowView,
}: {
  initialVisibleDirectoryIds: string[] | null | undefined
  directories: WorkingDirectory[]
  directoryTargetMode: boolean
  selectedDirectoryId: string
  onAction: DesktopActionInvoker
  onDirectoryPrimeSelection: (directoryId: string) => void
  onDirectorySelect: (directoryId: string) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
}) {
  const [directorySwitcherOpen, setDirectorySwitcherOpen] = useState(false)
  const [visibleDirectoryIdsOverride, setVisibleDirectoryIdsOverride] = useState<
    string[] | null | undefined
  >(undefined)
  const [scopeSelectorOrderIds, setScopeSelectorOrderIds] = useState<string[] | null>(null)
  const appliedInitialEmptyScopeRef = useRef(false)
  const displayableWorkspaces = useMemo(() => getDisplayableWorkspaces(directories), [directories])
  const displayableDirectories = useMemo(
    () => getDisplayableDirectories(directories),
    [directories],
  )
  const selectedDirectory = getSelectedDirectoryForScope({
    directories: displayableDirectories,
    selectedDirectoryId,
    workspaces: displayableWorkspaces,
  })
  const configuredVisibleDirectoryIds =
    visibleDirectoryIdsOverride === undefined
      ? initialVisibleDirectoryIds
      : visibleDirectoryIdsOverride
  const storedVisibleDirectoryIds = useMemo(
    () => filterVisibleDirectoryIds(configuredVisibleDirectoryIds, displayableDirectories),
    [configuredVisibleDirectoryIds, displayableDirectories],
  )
  const visibleDirectoryIds = getVisibleDirectoryIds(
    storedVisibleDirectoryIds ?? null,
    null,
    selectedDirectory,
  )
  const visibleDirectories = useMemo(() => {
    const visibleIds = new Set(visibleDirectoryIds)
    return displayableDirectories.filter((directory) => visibleIds.has(directory.id))
  }, [displayableDirectories, visibleDirectoryIds])
  const scopeSelectorDirectories = useMemo(
    () =>
      orderDirectoriesForScopeSelector(
        displayableDirectories,
        directorySwitcherOpen && scopeSelectorOrderIds
          ? scopeSelectorOrderIds
          : visibleDirectoryIds,
      ),
    [displayableDirectories, directorySwitcherOpen, scopeSelectorOrderIds, visibleDirectoryIds],
  )
  const scopeDirectory =
    visibleDirectories.find((directory) => directory.id === selectedDirectory?.id) ??
    visibleDirectories[0] ??
    null
  const directoryScopeLabel = getDirectoryScopeLabel({ selectedDirectory, visibleDirectories })

  useEffect(() => {
    if (appliedInitialEmptyScopeRef.current || initialVisibleDirectoryIds === undefined) return
    appliedInitialEmptyScopeRef.current = true
    if (directoryTargetMode) return
    if (initialVisibleDirectoryIds === null || initialVisibleDirectoryIds.length > 0) return
    onShowView('landing')
  }, [initialVisibleDirectoryIds, onShowView, directoryTargetMode])

  const focusDirectory = (directoryId: string) => {
    onDirectorySelect(directoryId)
    void onAction('directory.select', { directoryId })
  }
  const primeDirectory = (directoryId: string) => {
    onDirectoryPrimeSelection(directoryId)
    void onAction('directory.select', { directoryId })
  }
  const toggleVisibleDirectory = (directoryId: string) => {
    const toggle = toggleVisibleDirectoryId(directoryId, visibleDirectoryIds)
    setVisibleDirectoryIdsOverride(toggle.nextDirectoryIds)
    if (toggle.shouldFocusDirectory) focusDirectory(directoryId)
    if (toggle.shouldShowLanding) onShowView('landing')
  }
  const setDirectorySwitcherOpenState = (open: boolean) => {
    if (open) setScopeSelectorOrderIds(visibleDirectoryIds)
    setDirectorySwitcherOpen(open)
    if (open || storedVisibleDirectoryIds === null) return
    setScopeSelectorOrderIds(null)
    void onAction('coding.sidebar-scope', { directoryIds: storedVisibleDirectoryIds })
  }

  return {
    displayableDirectories,
    displayableWorkspaces,
    focusDirectory,
    primeDirectory,
    directoryScopeLabel,
    directorySwitcherOpen,
    scopeDirectory,
    scopeSelectorDirectories,
    selectedDirectory,
    setDirectorySwitcherOpen: setDirectorySwitcherOpenState,
    toggleVisibleDirectory,
    visibleDirectories,
  }
}
