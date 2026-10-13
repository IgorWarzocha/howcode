import type { QueryClient } from '@tanstack/react-query'
import type { DesktopAction } from '../desktop/actions'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { ActionPayload } from './controller-action-utils'
import {
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedChatShellState,
  getOptimisticallyRenamedShellState,
} from './optimistic-directories'
import { getOptimisticallyUpdatedShellState } from './optimistic-settings'
import { getOptimisticallyUpdatedShellPreferencesState } from './optimistic-shell-preferences'

export {
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedChatShellState,
  getOptimisticallyRenamedShellState,
} from './optimistic-directories'
export { getOptimisticallyUpdatedShellState } from './optimistic-settings'
export { getOptimisticallyUpdatedShellPreferencesState } from './optimistic-shell-preferences'

export function applyOptimisticSettingsUpdate(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellState(currentState ?? null, payload),
  )
}

export function applyOptimisticShellPreferencesUpdate(
  queryClient: QueryClient,
  payload: ActionPayload,
) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyUpdatedShellPreferencesState(currentState ?? null, payload),
  )
}

export function applyOptimisticDirectoryRename(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyRenamedShellState(currentState ?? null, payload),
  )
}

export function applyOptimisticChatRename(queryClient: QueryClient, payload: ActionPayload) {
  queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) =>
    getOptimisticallyRenamedChatShellState(currentState ?? null, payload),
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

export function applyOptimisticDesktopAction(
  queryClient: QueryClient,
  action: DesktopAction,
  payload: ActionPayload,
) {
  switch (action) {
    case 'settings.update':
      return applyOptimisticSettingsUpdate(queryClient, payload)
    case 'shell-preferences.update':
      return applyOptimisticShellPreferencesUpdate(queryClient, payload)
    case 'directory.edit-name':
      return applyOptimisticDirectoryRename(queryClient, payload)
    case 'chat.rename':
      return applyOptimisticChatRename(queryClient, payload)
    case 'chat.pin':
    case 'directory.pin':
      return applyOptimisticPinUpdate(queryClient, action, payload)
    default:
      return undefined
  }
}
