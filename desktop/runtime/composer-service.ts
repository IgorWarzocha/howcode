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
import { getPiModule } from '../pi-module.ts'
import { buildComposerAttachmentPrompt } from './attachments.ts'
import {
  buildComposerQueueSnapshotKey,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from './composer-queue'
import {
  buildComposerState,
  buildComposerStateSnapshot,
  clampThinkingLevel,
  createComposerSnapshotSession,
  getAvailableThinkingLevelsForModel,
} from './composer-state.ts'
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

async function selectRequestedComposerModel(runtime: PiRuntime, request: ComposerStateRequest) {
  const selection = request.composerModelSelection ?? null
  if (selection?.provider) {
    const model = runtime.session.modelRegistry.find(selection.provider, selection.id)
    if (model) return model
    const [fallbackModel] = await runtime.session.modelRegistry.getAvailable()
    return fallbackModel ?? runtime.session.model
  }
  if (!request.composerUseDefaultModel) return runtime.session.model
  const defaultComposer = await buildComposerStateSnapshot({
    projectId: runtime.cwd,
    composerSessionDir: request.composerSessionDir,
  })
  if (!defaultComposer.currentModel) return runtime.session.model
  return (
    runtime.session.modelRegistry.find(
      defaultComposer.currentModel.provider,
      defaultComposer.currentModel.id,
    ) ?? runtime.session.model
  )
}

async function getRequestedComposerThinkingLevel(
  runtime: PiRuntime,
  request: ComposerStateRequest,
) {
  if (request.composerThinkingLevel) return request.composerThinkingLevel
  if (!Object.hasOwn(request, 'composerThinkingLevel')) return null
  const defaultComposer = await buildComposerStateSnapshot({
    projectId: runtime.cwd,
    composerSessionDir: request.composerSessionDir,
  })
  return defaultComposer.currentThinkingLevel
}

async function applyComposerModeSettings(runtime: PiRuntime, request: ComposerStateRequest) {
  const selectedModel = (await selectRequestedComposerModel(runtime, request)) ?? null
  if (selectedModel && selectedModel !== runtime.session.model)
    await runtime.session.setModel(selectedModel)
  const thinkingLevel = await getRequestedComposerThinkingLevel(runtime, request)
  if (thinkingLevel) {
    runtime.session.setThinkingLevel(
      clampThinkingLevel(thinkingLevel, getAvailableThinkingLevelsForModel(selectedModel ?? null)),
    )
  }
}
async function promptAndReturnAfterPreflight({
  runtime,
  message,
  options,
  request,
}: {
  runtime: PiRuntime
  message: string
  options?: Parameters<PiRuntime['session']['prompt']>[1]
  request: ComposerStateRequest
}) {
  let resolvePreflight: (success: boolean) => void
  const preflight = new Promise<boolean>((resolve) => {
    resolvePreflight = resolve
  })

  const promptPromise = runtime.session.prompt(message, {
    ...options,
    preflightResult: (success) => resolvePreflight(success),
  })

  const accepted = await preflight
  if (!accepted) {
    await promptPromise
    return
  }

  promptPromise
    .catch((error) => {
      console.error('Composer prompt failed after dispatch', error)
      void emitComposerUpdate({
        ...request,
        sessionPath: getPersistedSessionPath(runtime.session.sessionFile),
      })
    })
    .finally(() => {
      scheduleRuntimeDisposalForRuntime(runtime)
    })
}

async function setDraftComposerModel(
  request: ComposerStateRequest,
  cwd: string,
  provider: string,
  modelId: string,
) {
  const { SettingsManager, getAgentDir } = await getPiModule()
  const agentDir = getAgentDir()
  const snapshot = await createComposerSnapshotSession({
    ...request,
    projectId: cwd,
    sessionPath: null,
  })

  try {
    const model = snapshot.session.modelRegistry.find(provider, modelId)

    if (!model) {
      throw new Error(`Unknown Pi model: ${provider}/${modelId}`)
    }

    const currentComposer = await buildComposerStateSnapshot({
      ...request,
      projectId: cwd,
      sessionPath: null,
    })
    const nextThinkingLevel = clampThinkingLevel(
      currentComposer.currentThinkingLevel,
      getAvailableThinkingLevelsForModel(model),
    )
    const settingsManager = SettingsManager.create(cwd, agentDir)

    settingsManager.setDefaultModelAndProvider(provider, modelId)
    settingsManager.setDefaultThinkingLevel(nextThinkingLevel)
  } finally {
    snapshot.session.dispose()
  }
}

async function setDraftComposerThinkingLevel(cwd: string, level: ComposerThinkingLevel) {
  const { SettingsManager, getAgentDir } = await getPiModule()
  const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null })
  SettingsManager.create(cwd, getAgentDir()).setDefaultThinkingLevel(
    clampThinkingLevel(level, currentComposer.availableThinkingLevels),
  )
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
    await setDraftComposerModel(
      request,
      request.projectId ?? getDesktopWorkingDirectory(),
      provider,
      modelId,
    )
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
    await setDraftComposerThinkingLevel(request.projectId ?? getDesktopWorkingDirectory(), level)
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

function buildComposerSendResult(runtime: PiRuntime, outcome: 'sent' | 'stopped') {
  return {
    outcome,
    sessionPath: getPersistedSessionPath(runtime.session.sessionFile),
    threadId: runtime.session.sessionId ?? null,
  }
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

async function restoreQueueAfterReplayFailure(input: {
  clearedQueue: ReturnType<PiRuntime['session']['clearQueue']>
  error: unknown
  request: ComposerStateRequest
  runtime: PiRuntime
  sessionPath: string
}) {
  input.runtime.session.clearQueue()
  try {
    await replayComposerQueue(input.runtime.session, input.clearedQueue)
    await emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
  } catch (rollbackError) {
    throw new Error(
      rollbackError instanceof Error
        ? `Could not restore queued prompts after dequeue replay failure: ${rollbackError.message}`
        : 'Could not restore queued prompts after dequeue replay failure.',
    )
  }
  throw input.error
}

async function replayDequeuedComposerQueue(input: {
  clearedQueue: ReturnType<PiRuntime['session']['clearQueue']>
  dequeueResult: NonNullable<ReturnType<typeof removeQueuedPromptById>>
  request: ComposerStateRequest
  runtime: PiRuntime
  sessionPath: string
}) {
  try {
    await replayComposerQueue(input.runtime.session, input.dequeueResult.nextQueue)
    await emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
    return input.dequeueResult.dequeuedText
  } catch (error) {
    await restoreQueueAfterReplayFailure({ ...input, error })
    return null
  }
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
      const currentQueueSnapshot = {
        steering: [...runtime.session.getSteeringMessages()],
        followUp: [...runtime.session.getFollowUpMessages()],
      }

      if (buildComposerQueueSnapshotKey(currentQueueSnapshot) !== request.queueSnapshotKey) {
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
        return null
      }

      const currentQueue =
        request.queueMode === 'steer'
          ? currentQueueSnapshot.steering
          : currentQueueSnapshot.followUp
      if (findQueuedPromptIndexById(request.queueMode, currentQueue, request.queueId) === null) {
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
        return null
      }

      const clearedQueue = runtime.session.clearQueue()
      const dequeueResult = removeQueuedPromptById(clearedQueue, request.queueMode, request.queueId)

      if (!dequeueResult) {
        await replayComposerQueue(runtime.session, clearedQueue)
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
        return null
      }

      return await replayDequeuedComposerQueue({
        clearedQueue,
        dequeueResult,
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
