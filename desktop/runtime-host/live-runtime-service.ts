import { parseCompactSlashCommand } from '../../shared/composer-slash-commands.ts'
import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { createLocalThreadDraft, getPersistedSessionPath } from '../../shared/session-paths.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getPiModule } from '../pi-module.ts'
import { dequeueComposerPromptFromRuntime } from '../runtime/composer-dequeue.ts'
import {
  applyComposerModeSettings,
  setDraftComposerModel,
  setDraftComposerThinkingLevel,
} from '../runtime/composer-mode-settings.ts'
import {
  buildComposerPromptMessage,
  compactComposerRuntime,
  promptComposerRuntime,
} from '../runtime/composer-prompt-flow.ts'
import {
  expandRuntimeDollarSkillReferences,
  mapSessionSkills,
} from '../runtime/composer-skill-references.ts'
import { buildComposerState, buildComposerStateSnapshot } from '../runtime/composer-state.ts'
import { stopComposerRuntime } from '../runtime/composer-stop.ts'
import { setRuntimeProjectTrust } from '../runtime/isolated-settings-manager.ts'
import {
  answerPiExtensionDialog as answerPiExtensionDialogForRuntime,
  bindPiExtensionEditorState,
} from '../runtime/pi-extension-ui-state.ts'
import type { PiRuntime } from '../runtime/types.ts'
import { getComposerSessionResources } from './composer-resource-service.ts'
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
import {
  publishComposerUpdate,
  publishPiExtensionUiUpdate,
  publishThreadUpdate,
} from './live-thread-publisher.ts'
import { labelSessionTreeEntry, navigateSessionTree } from './session-tree-navigation.ts'
import { mapSessionCommands } from './slash-command-service.ts'

async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const runtime = persistedSessionPath
    ? await getCachedRuntimeForSessionPath(persistedSessionPath)
    : null
  const composer = runtime
    ? await buildComposerState(runtime)
    : await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath })
  publishComposerUpdate(composer, {
    projectId: request.projectId ?? null,
    sessionPath: persistedSessionPath,
  })
  return { composer, runtime }
}

export async function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  return await getComposerSessionResources(request, mapSessionCommands)
}

export async function getComposerSkills(request: ComposerStateRequest = {}) {
  return await getComposerSessionResources(request, mapSessionSkills)
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
    const cwd = request.projectId ?? getDesktopWorkingDirectory()
    await setDraftComposerModel({ cwd, modelId, provider, request })
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
    const cwd = request.projectId ?? getDesktopWorkingDirectory()
    await setDraftComposerThinkingLevel({ cwd, level })
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

const scheduleRuntimeDisposalForRuntime = (runtime: PiRuntime) => {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile)
  if (runtimeKey) scheduleRuntimeDisposal(runtimeKey)
}

const composerPromptAdapters = {
  emitComposerUpdate,
  isRuntimeExtensionCommandRunning,
  publishThreadUpdate,
  scheduleRuntimeDisposal: scheduleRuntimeDisposalForRuntime,
}

const composerStopAdapters = {
  abortRuntimeExtensionCommand,
  emitComposerUpdate,
  scheduleRuntimeDisposal: scheduleRuntimeDisposalForRuntime,
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
          adapters: composerPromptAdapters,
          compactInstructions,
          persistedSessionPath,
          request,
          runtime,
        })
      }
      const skillExpandedText = expandRuntimeDollarSkillReferences(runtime, request.text)
      const message = buildComposerPromptMessage({
        attachments: request.attachments,
        text: skillExpandedText,
      })
      const streamingBehavior =
        request.streamingBehavior ??
        request.composerStreamingBehavior ??
        loadAppSettings().composerStreamingBehavior
      return await promptComposerRuntime({
        adapters: composerPromptAdapters,
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
      { branchName: request.branchName ?? null, chatGroupId: request.chatGroupId ?? null },
    )
    await applyComposerModeSettings(runtime, request)
    return await runSend(runtime)
  }
  const cachedRuntime = await getCachedRuntimeForSessionPath(persistedSessionPath)
  if (cachedRuntime) {
    if (cachedRuntime.session.isStreaming || isRuntimeExtensionCommandRunning(cachedRuntime)) {
      cachedRuntime.branchName = request.branchName ?? cachedRuntime.branchName ?? null
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
    runtime.branchName = request.branchName ?? runtime.branchName ?? null
    await applyComposerModeSettings(runtime, request)
    return await runSend(runtime)
  })
}

export async function navigateSessionTreeInHost(
  request: ComposerStateRequest & {
    targetEntryId: string
    summarize: boolean
    label?: string | undefined | null
  },
) {
  return navigateSessionTree({
    request,
    targetEntryId: request.targetEntryId,
    summarize: request.summarize,
    label: request.label,
  })
}

export async function labelSessionTreeEntryInHost(
  request: ComposerStateRequest & {
    targetEntryId: string
    label?: string | undefined | null
  },
) {
  return labelSessionTreeEntry({
    request,
    targetEntryId: request.targetEntryId,
    label: request.label,
  })
}

export async function stopComposerRun(request: ComposerStateRequest) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: true as const }
  const cachedRuntime = await getCachedRuntimeForSessionPath(persistedSessionPath)
  if (cachedRuntime) {
    const stopped = await stopComposerRuntime({
      abortWhenIdle: false,
      adapters: composerStopAdapters,
      request,
      runtime: cachedRuntime,
      sessionPath: persistedSessionPath,
    })
    if (stopped) return { ok: true as const }
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false })
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    await stopComposerRuntime({
      abortWhenIdle: true,
      adapters: composerStopAdapters,
      request,
      runtime,
      sessionPath: persistedSessionPath,
    })
  })
  return { ok: true as const }
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
      return await dequeueComposerPromptFromRuntime({
        emitComposerUpdate,
        request,
        runtime,
        sessionPath: persistedSessionPath,
      })
    } finally {
      scheduleRuntimeDisposal(persistedSessionPath)
    }
  })
}

export async function answerPiExtensionDialog(
  request: ComposerStateRequest & {
    requestId: string
    cancelled?: boolean | undefined
    confirmed?: boolean | undefined
    value?: string | undefined
  },
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: false }

  try {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    const ok = answerPiExtensionDialogForRuntime(runtime, request.requestId, {
      cancelled: request.cancelled,
      confirmed: request.confirmed,
      value: request.value,
    })
    publishPiExtensionUiUpdate(runtime)
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath })
    return { ok }
  } finally {
    scheduleRuntimeDisposal(persistedSessionPath)
  }
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  const projectId = request.projectId ?? getDesktopWorkingDirectory()
  const composer = await buildComposerStateSnapshot({ ...request, projectId, sessionPath: null })
  const draft = createLocalThreadDraft(projectId, undefined, {
    branchName: request.branchName,
    chatGroupId: request.chatGroupId,
  })
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

export async function invokePiExtensionShortcut(
  request: ComposerStateRequest & {
    editorSelectionEnd?: number | undefined
    editorSelectionStart?: number | undefined
    editorText?: string | undefined
    shortcut: string
  },
): Promise<{
  editorSelectionEnd?: number | undefined
  editorSelectionStart?: number | undefined
  editorText?: string | undefined
  ok: boolean
}> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) return { ok: false }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    })
    try {
      const shortcut = runtime.session.extensionRunner
        .getShortcuts({} as never)
        .get(request.shortcut.toLowerCase() as never)
      if (!shortcut) return { ok: false }
      const unbindEditorState = bindPiExtensionEditorState(runtime, {
        changed: false,
        selectionEnd: request.editorSelectionEnd ?? request.editorText?.length ?? 0,
        selectionStart: request.editorSelectionStart ?? request.editorText?.length ?? 0,
        text: request.editorText ?? '',
      })
      let editorState: ReturnType<typeof unbindEditorState>
      try {
        await shortcut.handler(runtime.session.extensionRunner.createContext())
      } finally {
        editorState = unbindEditorState()
      }
      const composer = await buildComposerState(runtime)
      publishComposerUpdate(composer, {
        projectId: request.projectId ?? runtime.cwd,
        sessionPath: persistedSessionPath,
      })
      return editorState.changed
        ? {
            editorSelectionEnd: editorState.selectionEnd,
            editorSelectionStart: editorState.selectionStart,
            editorText: editorState.text,
            ok: true,
          }
        : { ok: true }
    } finally {
      scheduleRuntimeDisposalForRuntime(runtime)
    }
  })
}

export async function setProjectTrust(
  request: ComposerStateRequest & { cwd: string; trusted: boolean },
): Promise<{ ok: true }> {
  const { ProjectTrustStore, getAgentDir } = await getPiModule()
  setRuntimeProjectTrust({
    ProjectTrustStore,
    agentDir: getAgentDir(),
    cwd: request.cwd,
    trusted: request.trusted,
  })
  return { ok: true }
}
