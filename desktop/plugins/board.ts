import type { PluginBoardFamily } from '@howaboua/howcode-sdk/board-family'
import { resolveInstalledBoardCapability } from './runtime.ts'

/** Resolve each call against the active, generation-leased Board provider. */
export function createPluginBoard(): PluginBoardFamily {
  const current = () => {
    const board = resolveInstalledBoardCapability()
    if (!board) throw new Error('Board capability is unavailable. Install and activate Board.')
    return board
  }
  return {
    family: (id) => current().family(id),
    enrol: (input) => current().enrol(input),
    designateResident: (input) => current().designateResident(input),
    grantParticipation: (input) => current().grantParticipation(input),
    revokeParticipation: (input) => current().revokeParticipation(input),
    ensureSetupThread: (input) => current().ensureSetupThread(input),
    recordSetup: (input) => current().recordSetup(input),
    threads: (id, query) => current().threads(id, query),
    threadReference: (tx, id, threadId) => current().threadReference(tx, id, threadId),
  }
}
