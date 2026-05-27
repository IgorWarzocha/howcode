import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import type { PiRuntime } from './types.ts'

export type ComposerStopAdapters = {
  abortRuntimeExtensionCommand: (runtime: PiRuntime) => boolean
  emitComposerUpdate: (request?: ComposerStateRequest) => Promise<unknown>
  scheduleRuntimeDisposal: (runtime: PiRuntime) => void
}

export async function stopComposerRuntime(input: {
  adapters: ComposerStopAdapters
  request: ComposerStateRequest
  runtime: PiRuntime
  sessionPath: string
  abortWhenIdle: boolean
}) {
  const { abortWhenIdle, adapters, request, runtime, sessionPath } = input
  const abortedExtensionCommand = adapters.abortRuntimeExtensionCommand(runtime)
  const wasStreaming = runtime.session.isStreaming
  if (wasStreaming) {
    await runtime.session.abort()
  }
  if (abortWhenIdle && !(abortedExtensionCommand || wasStreaming)) {
    await runtime.session.abort()
  }
  if (!(abortWhenIdle || abortedExtensionCommand || wasStreaming)) return false
  adapters.scheduleRuntimeDisposal(runtime)
  await adapters.emitComposerUpdate({ ...request, sessionPath })
  return true
}
