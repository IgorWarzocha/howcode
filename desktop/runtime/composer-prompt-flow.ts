const whitespaceRunPattern = /\s+/

import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
} from '../../shared/desktop-contracts.ts'
import { buildComposerAttachmentPrompt } from './attachments.ts'
import { promptAndReturnAfterPreflight } from './composer-preflight.ts'
import { buildComposerSendResult } from './composer-send-result.ts'
import type { PiRuntime } from './types.ts'

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

export type ComposerPromptFlowAdapters = {
  emitComposerUpdate: (request?: ComposerStateRequest) => Promise<unknown>
  isRuntimeExtensionCommandRunning: (runtime: PiRuntime) => boolean
  publishThreadUpdate: (runtime: PiRuntime, reason: 'update') => Promise<unknown>
  scheduleRuntimeDisposal: (runtime: PiRuntime) => void
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

export async function compactComposerRuntime(input: {
  adapters: ComposerPromptFlowAdapters
  compactInstructions: string
  persistedSessionPath: string | null
  request: ComposerStateRequest
  runtime: PiRuntime
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
  await runtime.session.compact(compactInstructions.length > 0 ? compactInstructions : undefined)
  await adapters.emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  return buildComposerSendResult(runtime, 'sent')
}

export async function promptComposerRuntime(input: {
  adapters: ComposerPromptFlowAdapters
  message: string
  persistedSessionPath: string | null
  request: ComposerPromptRequest
  runtime: PiRuntime
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
  await promptAndReturnAfterPreflight({
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
