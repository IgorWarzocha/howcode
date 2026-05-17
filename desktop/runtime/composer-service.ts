const whitespaceRunPattern = /\s+/

import { parseCompactSlashCommand } from '../../shared/composer-slash-commands.ts'
import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { createLocalThreadDraft, getPersistedSessionPath } from '../../shared/session-paths.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { buildComposerAttachmentPrompt } from './attachments.ts'
import { dequeueComposerPromptFromRuntime } from './composer-dequeue.ts'
import {
  applyComposerModeSettings,
  setDraftComposerModel,
  setDraftComposerThinkingLevel,
} from './composer-mode-settings.ts'
import { promptAndReturnAfterPreflight } from './composer-preflight.ts'
import { buildComposerSendResult } from './composer-send-result.ts'
import { buildComposerState, buildComposerStateSnapshot } from './composer-state.ts'
import {
  abortRuntimeExtensionCommand,
  createRuntimeForNewSession,
  getCachedRuntimeForSessionPath,
  getOrCreateRuntimeForSessionPath,
  isRuntimeExtensionCommandRunning,
  scheduleRuntimeDisposalForRuntime,
  withRuntimeMutationLock,
} from './runtime-registry.ts'
import {
  getLiveThread,
  publishComposerUpdate,
  publishThreadUpdate,
  subscribeDesktopEvents,
} from './thread-publisher.ts'
import type { PiRuntime } from './types.ts'

async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null
  const runtime = runtimePromise ? await runtimePromise : null
  const composer = runtime
    ? await buildComposerState(runtime)
    : await buildComposerStateSnapshot({
        ...request,
        sessionPath: persistedSessionPath,
      })

  publishComposerUpdate(composer, {
    projectId: request.projectId ?? null,
    sessionPath: persistedSessionPath,
  })

  return {
    composer,
    runtime,
  }
}

function isExtensionCommandPrompt(runtime: PiRuntime, text: string) {
  if (!text.startsWith('/')) return false
  const commandName = text.slice(1).split(whitespaceRunPattern, 1)[0] ?? ''
  return Boolean(runtime.session.extensionRunner.getCommand(commandName))
}

export { getLiveThread, subscribeDesktopEvents }

export async function getComposerState(request: ComposerStateRequest = {}): Promise<ComposerState> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null

  // Reads should reflect the current in-memory runtime state. Reloading or publishing here can
  // race with just-applied composer mutations and re-broadcast stale snapshots back into the UI.
  if (runtimePromise && persistedSessionPath) {
    return await withRuntimeMutationLock(persistedSessionPath, async () => {
      const runtime = await runtimePromise
      if (!(runtime.session.isStreaming || isRuntimeExtensionCommandRunning(runtime))) {
        await applyComposerModeSettings(runtime, request)
      }
      return await buildComposerState(runtime)
    })
  }

  return await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath })
}

export async function setComposerModel(
  request: ComposerStateRequest,
  provider: string,
  modelId: string,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)

  if (!persistedSessionPath) {
    await setDraftComposerModel({
      cwd: request.projectId ?? getDesktopWorkingDirectory(),
      modelId,
      provider,
      request,
    })
    return emitComposerUpdate({ ...request, sessionPath: null })
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    const model = runtime.session.modelRegistry.find(provider, modelId)

    if (!model) {
      throw new Error(`Unknown Pi model: ${provider}/${modelId}`)
    }

    await runtime.session.setModel(model)
    scheduleRuntimeDisposalForRuntime(runtime)
    return emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  })
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)

  if (!persistedSessionPath) {
    await setDraftComposerThinkingLevel({
      cwd: request.projectId ?? getDesktopWorkingDirectory(),
      level,
    })
    return emitComposerUpdate({ ...request, sessionPath: null })
  }

  await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    runtime.session.setThinkingLevel(level)
    scheduleRuntimeDisposalForRuntime(runtime)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  })
}

async function compactComposerRuntime(input: {
  compactInstructions: string
  persistedSessionPath: string | null
  request: ComposerStateRequest
  runtime: PiRuntime
}) {
  const { compactInstructions, persistedSessionPath, request, runtime } = input
  if (isRuntimeExtensionCommandRunning(runtime))
    throw new Error('Wait for the current extension command to finish before compacting.')
  if (runtime.session.isStreaming)
    throw new Error('Wait for the current response to finish before compacting.')
  if (runtime.session.isCompacting)
    throw new Error('Wait for the current compaction to finish before compacting again.')
  const entries = runtime.session.sessionManager.getBranch()
  if (entries.filter((entry) => entry.type === 'message').length < 2)
    throw new Error('Nothing to compact (no messages yet)')
  await runtime.session.compact(compactInstructions.length > 0 ? compactInstructions : undefined)
  await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  return buildComposerSendResult(runtime, 'sent')
}

async function promptComposerRuntime(input: {
  message: string
  persistedSessionPath: string | null
  request: ComposerStateRequest & {
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior | null
  }
  runtime: PiRuntime
  streamingBehavior: ComposerStreamingBehavior
}) {
  const { message, persistedSessionPath, request, runtime, streamingBehavior } = input
  if (runtime.session.isCompacting)
    throw new Error('Wait for the current compaction to finish before sending another prompt.')
  if (
    runtime.session.isStreaming &&
    streamingBehavior === 'stop' &&
    !isExtensionCommandPrompt(runtime, request.text)
  ) {
    await runtime.session.abort()
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
    return buildComposerSendResult(runtime, 'stopped')
  }
  await runtime.attachmentFileAccess?.grantAttachments(request.attachments ?? [])
  await promptAndReturnAfterPreflight({
    emitComposerUpdate,
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
    scheduleRuntimeDisposal: () => scheduleRuntimeDisposalForRuntime(runtime),
  })
  await publishThreadUpdate(runtime, 'update').catch((error) => {
    console.error('Composer prompt accepted but thread update publish failed', error)
  })
  return buildComposerSendResult(runtime, 'sent')
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & {
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior | null
  },
): Promise<{ outcome: 'sent' | 'stopped'; sessionPath: string | null; threadId: string | null }> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const compactInstructions = parseCompactSlashCommand(request.text)

  const runSend = async (runtime: Awaited<ReturnType<typeof getOrCreateRuntimeForSessionPath>>) => {
    try {
      if (compactInstructions !== null) {
        return await compactComposerRuntime({
          compactInstructions,
          persistedSessionPath,
          request,
          runtime,
        })
      }
      const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? [])
      const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ''}${request.text}`
      const streamingBehavior =
        request.streamingBehavior ??
        request.composerStreamingBehavior ??
        loadAppSettings().composerStreamingBehavior
      return await promptComposerRuntime({
        message,
        persistedSessionPath,
        request,
        runtime,
        streamingBehavior,
      })
    } finally {
      scheduleRuntimeDisposalForRuntime(runtime)
    }
  }

  if (!persistedSessionPath) {
    const runtime = await createRuntimeForNewSession(
      request.projectId ?? getDesktopWorkingDirectory(),
      request.composerSessionDir,
      { chatGroupId: request.chatGroupId ?? null },
    )
    await applyComposerModeSettings(runtime, request)
    return await runSend(runtime)
  }

  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath)
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise
    if (cachedRuntime.session.isStreaming || isRuntimeExtensionCommandRunning(cachedRuntime)) {
      return await runSend(cachedRuntime)
    }
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    await applyComposerModeSettings(runtime, request)
    return await runSend(runtime)
  })
}

export async function stopComposerRun(request: ComposerStateRequest): Promise<void> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) {
    return
  }

  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath)
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise
    const abortedExtensionCommand = abortRuntimeExtensionCommand(cachedRuntime)
    if (abortedExtensionCommand || cachedRuntime.session.isStreaming) {
      if (cachedRuntime.session.isStreaming) {
        await cachedRuntime.session.abort()
      }
      scheduleRuntimeDisposalForRuntime(cachedRuntime)
      await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
      return
    }
  }

  await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })

    const abortedExtensionCommand = abortRuntimeExtensionCommand(runtime)
    const wasStreaming = runtime.session.isStreaming
    if (wasStreaming) {
      await runtime.session.abort()
    }
    if (!(abortedExtensionCommand || wasStreaming)) await runtime.session.abort()
    scheduleRuntimeDisposalForRuntime(runtime)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  })
}

export async function dequeueComposerPrompt(
  request: ComposerStateRequest & {
    queueId: string
    queueSnapshotKey: string
    queueMode: Exclude<ComposerStreamingBehavior, 'stop'>
  },
): Promise<string | null> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) {
    return null
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })

    try {
      return await dequeueComposerPromptFromRuntime({
        emitComposerUpdate,
        request,
        runtime,
        sessionPath: persistedSessionPath,
      })
    } finally {
      scheduleRuntimeDisposalForRuntime(runtime)
    }
  })
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  const projectId = request.projectId ?? getDesktopWorkingDirectory()
  const composer = await buildComposerStateSnapshot({ ...request, projectId, sessionPath: null })
  const draft = createLocalThreadDraft(projectId, undefined, { chatGroupId: request.chatGroupId })

  publishComposerUpdate(composer, { projectId, sessionPath: null })

  return {
    composer,
    projectId,
    sessionPath: draft.sessionPath,
    threadId: draft.threadId,
  }
}

export async function selectProjectRuntime(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  const { composer } = await emitComposerUpdate({ ...request, sessionPath: null })
  return composer
}

export async function openThreadRuntime(request: ComposerStateRequest): Promise<ComposerState> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) {
    const { composer } = await emitComposerUpdate({ ...request, sessionPath: null })
    return composer
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    if (!(runtime.session.isStreaming || isRuntimeExtensionCommandRunning(runtime))) {
      await applyComposerModeSettings(runtime, request)
    }
    scheduleRuntimeDisposalForRuntime(runtime)
    const composer = await buildComposerState(runtime)
    publishComposerUpdate(composer, {
      projectId: request.projectId ?? runtime.cwd,
      sessionPath: persistedSessionPath,
    })
    return composer
  })
}
