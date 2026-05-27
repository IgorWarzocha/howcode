import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import type { PiRuntime } from './types.ts'

export async function promptAndReturnAfterPreflight(input: {
  acceptWhen?: (() => boolean) | undefined
  emitComposerUpdate: (request: ComposerStateRequest) => Promise<unknown>
  message: string
  options?: Parameters<PiRuntime['session']['prompt']>[1]
  request: ComposerStateRequest
  runtime: PiRuntime
  scheduleRuntimeDisposal: (runtimeKey: string) => void
}) {
  let resolvePreflight: (success: boolean) => void
  let settled = false
  const preflight = new Promise<boolean>((resolve) => {
    resolvePreflight = (success) => {
      if (settled) return
      settled = true
      resolve(success)
    }
  })

  const acceptancePoll = input.acceptWhen
    ? setInterval(() => {
        try {
          if (input.acceptWhen?.()) resolvePreflight(true)
        } catch {
          // Keep the prompt path authoritative if the optimistic acceptance check fails.
        }
      }, 25)
    : null
  acceptancePoll?.unref?.()

  const promptPromise = input.runtime.session.prompt(input.message, {
    ...input.options,
    preflightResult: (success) => resolvePreflight(success),
  })

  const accepted = await preflight
  if (acceptancePoll) clearInterval(acceptancePoll)
  if (!accepted) {
    await promptPromise
    return
  }

  promptPromise
    .catch((error) => {
      console.error('Composer prompt failed after dispatch', error)
      void input.emitComposerUpdate({
        ...input.request,
        sessionPath: getPersistedSessionPath(input.runtime.session.sessionFile),
      })
    })
    .finally(() => {
      const runtimeKey = getPersistedSessionPath(input.runtime.session.sessionFile)
      if (runtimeKey) input.scheduleRuntimeDisposal(runtimeKey)
    })
}
