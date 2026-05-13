const whitespaceRunPattern = /\s+/
const dollarSkillTokenPattern = /(^|\s)\$([\w./-]+)/g

import { parseCompactSlashCommand } from '../../shared/composer-slash-commands.ts'
import type {
  ComposerAttachment,
  ComposerSkillReference,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { createLocalThreadDraft, getPersistedSessionPath } from '../../shared/session-paths.ts'
import { getPiModule } from '../pi-module.ts'
import { discoverHeadlessAgentSessionResources } from '../runtime/agent-session-extensions.ts'
import { buildComposerAttachmentPrompt } from '../runtime/attachments.ts'
import {
  buildComposerQueueSnapshotKey,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from '../runtime/composer-queue'
import {
  buildComposerState,
  buildComposerStateSnapshot,
  clampThinkingLevel,
  createComposerSnapshotSession,
  getAvailableThinkingLevelsForModel,
} from '../runtime/composer-state.ts'
import { answerNativeAskQuestions as answerNativeAskQuestionsForRuntime } from '../runtime/native-ask-questions-state.ts'
import type { PiRuntime } from '../runtime/types.ts'
import {
  abortRuntimeExtensionCommand,
  createRuntimeForNewSession,
  getCachedRuntimeForSessionPath,
  getOrCreateRuntimeForSessionPath,
  isRuntimeExtensionCommandRunning,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposal,
  withRuntimeMutationLock,
} from './live-runtime-registry.ts'
import { publishComposerUpdate, publishThreadUpdate } from './live-thread-publisher.ts'
import { mapSessionCommands } from './slash-command-service.ts'

async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null
  const runtime = runtimePromise ? await runtimePromise : null
  const composer = runtime
    ? await buildComposerState(runtime)
    : await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath })
  publishComposerUpdate(composer, {
    projectId: request.projectId ?? null,
    sessionPath: persistedSessionPath,
  })
  return { composer, runtime }
}

function isExtensionCommandPrompt(runtime: PiRuntime, text: string) {
  if (!text.startsWith('/')) return false
  const commandName = text.slice(1).split(whitespaceRunPattern, 1)[0] ?? ''
  return Boolean(runtime.session.extensionRunner.getCommand(commandName))
}

function mapSessionSkills(session: PiRuntime['session']): ComposerSkillReference[] {
  return session.resourceLoader.getSkills().skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    filePath: skill.filePath,
    sourceInfo: skill.sourceInfo,
  }))
}

function buildSkillReferencePrompt(input: {
  skills: ComposerSkillReference[]
  userRequest: string
}) {
  return [
    'The user asked you to use the following skills. Read their SKILL.md files if available.',
    '',
    ...input.skills.map((skill) => `- $${skill.name}: ${skill.filePath}`),
    '',
    'User request:',
    input.userRequest,
  ].join('\n')
}

function expandDollarSkillReferences(runtime: PiRuntime, text: string) {
  const skillsByName = new Map(
    mapSessionSkills(runtime.session).map((skill) => [skill.name, skill]),
  )
  const skills: ComposerSkillReference[] = []
  const seenSkillNames = new Set<string>()

  for (const match of text.matchAll(dollarSkillTokenPattern)) {
    const skillName = match[2]
    if (!skillName || seenSkillNames.has(skillName)) continue
    const skill = skillsByName.get(skillName)
    if (!skill) continue
    seenSkillNames.add(skillName)
    skills.push(skill)
  }

  if (skills.length === 0) return text

  return buildSkillReferencePrompt({
    skills,
    userRequest: text,
  })
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
      const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
      if (runtimeKey) scheduleRuntimeDisposal(runtimeKey)
    })
}

export async function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (persistedSessionPath) {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    await reloadRuntimeSettingsIfSafe(persistedSessionPath)
    scheduleRuntimeDisposal(persistedSessionPath)
    return mapSessionCommands(runtime.session)
  }

  const snapshot = await createComposerSnapshotSession({
    ...request,
    projectId: request.projectId ?? getDesktopWorkingDirectory(),
    sessionPath: persistedSessionPath,
  })

  try {
    await discoverHeadlessAgentSessionResources(snapshot.session).catch((error) => {
      console.warn('Pi extension resource discovery failed', error)
    })
    return mapSessionCommands(snapshot.session)
  } finally {
    snapshot.session.dispose()
  }
}

export async function getComposerSkills(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (persistedSessionPath) {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    await reloadRuntimeSettingsIfSafe(persistedSessionPath)
    scheduleRuntimeDisposal(persistedSessionPath)
    return mapSessionSkills(runtime.session)
  }

  const snapshot = await createComposerSnapshotSession({
    ...request,
    projectId: request.projectId ?? getDesktopWorkingDirectory(),
    sessionPath: persistedSessionPath,
  })

  try {
    await discoverHeadlessAgentSessionResources(snapshot.session).catch((error) => {
      console.warn('Pi extension resource discovery failed', error)
    })
    return mapSessionSkills(snapshot.session)
  } finally {
    snapshot.session.dispose()
  }
}

export async function getComposerState(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (persistedSessionPath) {
    return await withRuntimeMutationLock(persistedSessionPath, async () => {
      const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
        suspendDisposal: true,
        settingsCwd: request.composerSessionDir ?? null,
        chatGroupId: request.chatGroupId ?? null,
      })
      if (!(runtime.session.isStreaming || isRuntimeExtensionCommandRunning(runtime))) {
        await applyComposerModeSettings(runtime, request)
      }
      scheduleRuntimeDisposal(persistedSessionPath)
      return await buildComposerState(runtime)
    })
  }

  return await buildComposerStateSnapshot({ ...request, sessionPath: null })
}

export async function setComposerModel(
  request: ComposerStateRequest,
  provider: string,
  modelId: string,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) {
    const { SettingsManager, getAgentDir } = await getPiModule()
    const cwd = request.projectId ?? getDesktopWorkingDirectory()
    const agentDir = getAgentDir()
    const snapshot = await createComposerSnapshotSession({
      ...request,
      projectId: cwd,
      sessionPath: null,
    })

    try {
      const model = snapshot.session.modelRegistry.find(provider, modelId)
      if (!model) throw new Error(`Unknown Pi model: ${provider}/${modelId}`)
      const currentComposer = await buildComposerStateSnapshot({
        ...request,
        projectId: cwd,
        sessionPath: null,
      })
      const settingsManager = SettingsManager.create(cwd, agentDir)
      settingsManager.setDefaultModelAndProvider(provider, modelId)
      settingsManager.setDefaultThinkingLevel(
        clampThinkingLevel(
          currentComposer.currentThinkingLevel,
          getAvailableThinkingLevelsForModel(model),
        ),
      )
    } finally {
      snapshot.session.dispose()
    }

    await emitComposerUpdate({ ...request, sessionPath: null })
    return { ok: true as const }
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    const model = runtime.session.modelRegistry.find(provider, modelId)
    if (!model) throw new Error(`Unknown Pi model: ${provider}/${modelId}`)
    await runtime.session.setModel(model)
    scheduleRuntimeDisposal(persistedSessionPath)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  })
  return { ok: true as const }
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) {
    const { SettingsManager, getAgentDir } = await getPiModule()
    const cwd = request.projectId ?? getDesktopWorkingDirectory()
    const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null })
    SettingsManager.create(cwd, getAgentDir()).setDefaultThinkingLevel(
      clampThinkingLevel(level, currentComposer.availableThinkingLevels),
    )
    await emitComposerUpdate({ ...request, sessionPath: null })
    return { ok: true as const }
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    runtime.session.setThinkingLevel(level)
    scheduleRuntimeDisposal(persistedSessionPath)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  })
  return { ok: true as const }
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
  await publishThreadUpdate(runtime, 'update').catch((error) =>
    console.error('Composer prompt accepted but thread update publish failed', error),
  )
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
  const runSend = async (runtime: PiRuntime) => {
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
      const skillExpandedText = expandDollarSkillReferences(runtime, request.text)
      const message = `${
        attachmentPrompt
          ? `${attachmentPrompt}

`
          : ''
      }${skillExpandedText}`
      const streamingBehavior =
        request.streamingBehavior ?? request.composerStreamingBehavior ?? 'followUp'
      return await promptComposerRuntime({
        message,
        persistedSessionPath,
        request,
        runtime,
        streamingBehavior,
      })
    } finally {
      const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
      if (runtimeKey) scheduleRuntimeDisposal(runtimeKey)
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
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    await applyComposerModeSettings(runtime, request)
    return await runSend(runtime)
  })
}

export async function stopComposerRun(request: ComposerStateRequest) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: true as const }
  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath)
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise
    const abortedExtensionCommand = abortRuntimeExtensionCommand(cachedRuntime)
    const wasStreaming = cachedRuntime.session.isStreaming
    if (wasStreaming) {
      await cachedRuntime.session.abort()
    }
    if (abortedExtensionCommand || wasStreaming) {
      scheduleRuntimeDisposal(persistedSessionPath)
      await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
      return { ok: true as const }
    }
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
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
    scheduleRuntimeDisposal(persistedSessionPath)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
  })
  return { ok: true as const }
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
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return null
  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
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
      scheduleRuntimeDisposal(persistedSessionPath)
    }
  })
}

export async function answerNativeAskQuestions(
  request: ComposerStateRequest & { requestId: string; answers: string[][] | null },
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: false }

  try {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    const ok = answerNativeAskQuestionsForRuntime(runtime, request.requestId, request.answers)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
    return { ok }
  } finally {
    scheduleRuntimeDisposal(persistedSessionPath)
  }
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  const projectId = request.projectId ?? getDesktopWorkingDirectory()
  const composer = await buildComposerStateSnapshot({ ...request, projectId, sessionPath: null })
  const draft = createLocalThreadDraft(projectId, undefined, { chatGroupId: request.chatGroupId })
  publishComposerUpdate(composer, { projectId, sessionPath: null })
  return { composer, projectId, sessionPath: draft.sessionPath, threadId: draft.threadId }
}

export async function selectProjectRuntime(request: ComposerStateRequest = {}) {
  const { composer } = await emitComposerUpdate({ ...request, sessionPath: null })
  return composer
}

export async function openThreadRuntime(request: ComposerStateRequest) {
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
    const composer = await buildComposerState(runtime)
    publishComposerUpdate(composer, {
      projectId: request.projectId ?? runtime.cwd,
      sessionPath: persistedSessionPath,
    })
    scheduleRuntimeDisposal(persistedSessionPath)
    return composer
  })
}
