import type { ComposerState, ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { disposeDurableRuntime } from '../durable-runtime/host.ts'
import {
  disposeThreadUpdateForwarding,
  getComposerSkills,
  getComposerSlashCommands,
  getComposerState,
  subscribeDesktopEvents as subscribeRuntimeEvents,
} from '../pi-desktop-runtime.ts'
import { disposeConversationProjection } from './conversation-projection.ts'

export { refreshShellIndex } from './shell-index.ts'
export { loadShellState } from './shell-state.ts'
export { loadInboxThreadList } from './thread-loader.ts'

export async function loadComposerState(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  return getComposerState(request)
}

export async function loadComposerSlashCommands(request: ComposerStateRequest = {}) {
  return getComposerSlashCommands(request)
}

export async function loadComposerSkills(request: ComposerStateRequest = {}) {
  return getComposerSkills(request)
}

export const subscribeDesktopEvents = subscribeRuntimeEvents

export async function disposeDesktopRuntime() {
  const results = await Promise.allSettled([
    disposeConversationProjection(),
    disposeThreadUpdateForwarding(),
  ])
  // The Harness is closed only after projection reads and watch publishers have settled.
  results.push(...(await Promise.allSettled([disposeDurableRuntime()])))
  const failures = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : [],
  )
  if (failures.length > 0) throw new AggregateError(failures, 'Failed to dispose desktop runtime.')
}
