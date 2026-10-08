import { useState } from 'react'
import {
  getBrowserStorage,
  hydratePersistedRecordMap,
} from '../../../../src/app/workspace-shell/persistence/persistedRecordStore'

export type GitDetailPlacement = 'main' | 'left' | 'right' | 'floating'
type GitDetailLayout = {
  placement: GitDetailPlacement
  sidebarWidth: number
  floatingWidth: number
  floatingHeight: number
  floatingX: number
  floatingY: number
}
const storageKey = 'howcode.git-detail-layout.v1'
const workspaceLayoutKey = 'workspace'
const defaultLayout: GitDetailLayout = {
  placement: 'main',
  sidebarWidth: 480,
  floatingWidth: 800,
  floatingHeight: 560,
  floatingX: 100,
  floatingY: 0,
}

export function isGitDetailPlacement(value: string): value is GitDetailPlacement {
  return value === 'main' || value === 'left' || value === 'right' || value === 'floating'
}

function validSize(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function decodeLayout(value: unknown): GitDetailLayout | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('placement' in value) ||
    typeof value.placement !== 'string' ||
    !isGitDetailPlacement(value.placement) ||
    !('sidebarWidth' in value) ||
    !validSize(value.sidebarWidth, 280, 960) ||
    !('floatingWidth' in value) ||
    !validSize(value.floatingWidth, 280, 1440) ||
    !('floatingHeight' in value) ||
    !validSize(value.floatingHeight, 240, 1000)
  )
    return null
  const floatingX = 'floatingX' in value ? value.floatingX : 100
  const floatingY = 'floatingY' in value ? value.floatingY : 0
  if (!(validSize(floatingX, 0, 100) && validSize(floatingY, 0, 100))) return null
  return {
    placement: value.placement,
    sidebarWidth: value.sidebarWidth,
    floatingWidth: value.floatingWidth,
    floatingHeight: value.floatingHeight,
    floatingX,
    floatingY,
  }
}

/** Layout is independent of detail demand: moving never changes the stream identity. */
export function useGitDetailLayout() {
  const [layout, setLayout] = useState(
    () =>
      hydratePersistedRecordMap({
        storage: getBrowserStorage(),
        storageKey,
        version: 1,
        recordKey: 'layouts',
        toEntry: decodeLayout,
      })[workspaceLayoutKey] ?? defaultLayout,
  )
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const updateLayout = (patch: Partial<GitDetailLayout>) => {
    const next = decodeLayout({ ...layout, ...patch })
    if (!next) return
    setLayout(next)
    try {
      const storage = getBrowserStorage()
      if (!storage) throw new Error('Browser storage is unavailable.')
      storage.setItem(storageKey, JSON.stringify({ version: 1, layouts: { workspace: next } }))
      setPersistenceError(null)
    } catch {
      setPersistenceError('Git layout could not be saved on this device.')
    }
  }
  return { layout, updateLayout, persistenceError }
}
