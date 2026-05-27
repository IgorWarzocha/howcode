import type { QueryClient } from '@tanstack/react-query'
import type { DesktopAction } from '../desktop/actions'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { ActionPayload } from './controller-action-utils'
import { getOptimisticallyUpdatedPiSettingsState } from './optimistic-pi-settings'
import {
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
} from './optimistic-projects'
import { getOptimisticallyUpdatedShellState } from './optimistic-settings'

export { getOptimisticallyUpdatedPiSettingsState } from './optimistic-pi-settings'
export {
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
} from './optimistic-projects'
export { getOptimisticallyUpdatedShellState } from './optimistic-settings'

export function applyOptimisticSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellState(currentState ?? null, payload),
  )
}

export function applyOptimisticPiSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedPiSettingsState(currentState ?? null, payload),
  )
}

export function applyOptimisticProjectRename(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyRenamedShellState(currentState ?? null, payload),
  )
}

export function applyOptimisticPinUpdate(
  queryClient: QueryClient,
  action: DesktopAction,
  payload: ActionPayload,
) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyPinnedShellState(currentState ?? null, action, payload),
  )
}
