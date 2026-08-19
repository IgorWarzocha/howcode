const whitespaceRunPattern = /\s+/

import * as Effect from 'effect/Effect'
import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
} from '../../shared/desktop-contracts.ts'
import { waitForConditionOrSettlement } from './async-observer.ts'
import { buildComposerAttachmentPrompt } from './attachments.ts'
import { promptAndReturnAfterPreflight } from './composer-preflight.ts'
import { buildComposerSendResult } from './composer-send-result.ts'
import type { PiRuntime, RuntimeThreadReason } from './types.ts'

export type ComposerPromptRequest = ComposerStateRequest & {
  text: string
  attachments?: ComposerAttachment[]
  streamingBehavior?: ComposerStreamingBehavior | null
}

export type ComposerSendOutcome = {
  outcome: 'sent' | 'stopped'
  sessionPath: string | null
  threadId: string | null
}

export type ComposerPromptFlowAdapters<Runtime extends PiRuntime = PiRuntime> = {
  emitComposerUpdate: (request?: ComposerStateRequest) => Promise<unknown>
  isRuntimeExtensionCommandRunning: (runtime: Runtime) => boolean
  publishThreadUpdate: (
    runtime: Runtime,
    reason: Extract<RuntimeThreadReason, 'update' | 'compaction'>,
  ) => Promise<unknown>
  scheduleRuntimeDisposal: (runtime: Runtime) => void
}

export function isExtensionCommandPrompt(runtime: PiRuntime, text: string) {
  if (!text.startsWith('/')) return false
  const commandName = text.slice(1).split(whitespaceRunPattern, 1)[0] ?? ''
  return Boolean(runtime.session.extensionRunner.getCommand(commandName))
}

export function buildComposerPromptMessage(input: {
  attachments?: ComposerAttachment[] | undefined
  text: string
}) {
  const attachmentPrompt = buildComposerAttachmentPrompt(input.attachments ?? [])
  return `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ''}${input.text}`
}

export async function compactComposerRuntime<Runtime extends PiRuntime>(input: {
  adapters: ComposerPromptFlowAdapters<Runtime>
  compactInstructions: string
  persistedSessionPath: string | null
  request: ComposerStateRequest
  runtime: Runtime
}): Promise<ComposerSendOutcome> {
  const { adapters, compactInstructions, persistedSessionPath, request, runtime } = input
  if (adapters.isRuntimeExtensionCommandRunning(runtime))
    throw new Error('Wait for the current extension command to finish before compacting.')
  if (runtime.session.isStreaming)
    throw new Error('Wait for the current response to finish before compacting.')
  if (runtime.session.isCompacting)
    throw new Error('Wait for the current compaction to finish before compacting again.')
  const entries = runtime.session.sessionManager.getBranch()
  if (entries.filter((entry) => entry.type === 'message').length < 2)
    throw new Error('Nothing to compact (no messages yet)')
  const compactPromise = runtime.session.compact(
    compactInstructions.length > 0 ? compactInstructions : undefined,
  )
  const outcome = await waitForCompactionStartOrSettlement(runtime, compactPromise)
  if (outcome === 'started') {
    compactPromise
      .then(() =>
        publishCompactionSettledState({ adapters, persistedSessionPath, request, runtime }),
      )
      .catch((error) => {
        console.error('Compaction failed after composer returned.', error)
        void publishCompactionSettledState({ adapters, persistedSessionPath, request, runtime })
      })
    return buildComposerSendResult(runtime, 'sent')
  }
  await publishCompactionSettledState({ adapters, persistedSessionPath, request, runtime })
  return buildComposerSendResult(runtime, 'sent')
}

async function waitForCompactionStartOrSettlement(
  runtime: PiRuntime,
  compactPromise: Promise<unknown>,
) {
  if (runtime.session.isCompacting) return 'started' as const
  const outcome = await Effect.runPromise(
    waitForConditionOrSettlement(() => runtime.session.isCompacting, compactPromise, 50),
  )
  return outcome === 'condition' ? ('started' as const) : ('settled' as const)
}

async function publishCompactionSettledState<Runtime extends PiRuntime>(input: {
  adapters: ComposerPromptFlowAdapters<Runtime>
  persistedSessionPath: string | null
  request: ComposerStateRequest
  runtime: Runtime
}) {
  await input.adapters.publishThreadUpdate(input.runtime, 'compaction').catch((error) => {
    console.error('Composer compaction settled but thread update publish failed', error)
  })
  await input.adapters.emitComposerUpdate({
    ...input.request,
    sessionPath: input.persistedSessionPath,
  })
}

export async function promptComposerRuntime<Runtime extends PiRuntime>(input: {
  adapters: ComposerPromptFlowAdapters<Runtime>
  message: string
  persistedSessionPath: string | null
  request: ComposerPromptRequest
  runtime: Runtime
  streamingBehavior: ComposerStreamingBehavior
}): Promise<ComposerSendOutcome> {
  const { adapters, message, persistedSessionPath, request, runtime, streamingBehavior } = input
  if (runtime.session.isCompacting)
    throw new Error('Wait for the current compaction to finish before sending another prompt.')
  if (
    runtime.session.isStreaming &&
    streamingBehavior === 'stop' &&
    !isExtensionCommandPrompt(runtime, request.text)
  ) {
    await runtime.session.abort()
    await adapters.emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
    return buildComposerSendResult(runtime, 'stopped')
  }
  await runtime.attachmentFileAccess?.grantAttachments(request.attachments ?? [])
  const isExtensionCommand = isExtensionCommandPrompt(runtime, request.text)
  await promptAndReturnAfterPreflight({
    ...(isExtensionCommand
      ? { acceptWhen: () => adapters.isRuntimeExtensionCommandRunning(runtime) }
      : {}),
    emitComposerUpdate: adapters.emitComposerUpdate,
    runtime,
    message,
    ...(runtime.session.isStreaming
      ? {
          options: {
            streamingBehavior: streamingBehavior === 'stop' ? 'followUp' : streamingBehavior,
          },
        }
      : {}),
    request: { ...request, sessionPath: persistedSessionPath },
    scheduleRuntimeDisposal: () => adapters.scheduleRuntimeDisposal(runtime),
  })
  await adapters.publishThreadUpdate(runtime, 'update').catch((error) => {
    console.error('Composer prompt accepted but thread update publish failed', error)
  })
  return buildComposerSendResult(runtime, 'sent')
}
