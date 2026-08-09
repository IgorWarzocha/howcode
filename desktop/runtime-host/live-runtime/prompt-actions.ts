import { parseCompactSlashCommand } from '../../../shared/composer-slash-commands.ts'
import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
} from '../../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import { getPersistedSessionPath } from '../../../shared/session-paths.ts'
import { loadAppSettings } from '../../app-settings/readers.ts'
import { dequeueComposerPromptFromRuntime } from '../../runtime/composer-dequeue.ts'
import { applyComposerModeSettings } from '../../runtime/composer-mode-settings.ts'
import {
  buildComposerPromptMessage,
  compactComposerRuntime,
  promptComposerRuntime,
} from '../../runtime/composer-prompt-flow.ts'
import { expandRuntimeDollarSkillReferences } from '../../runtime/composer-skill-references.ts'
import { stopComposerRuntime } from '../../runtime/composer-stop.ts'
import {
  abortRuntimeExtensionCommand,
  createRuntimeForNewSession,
  getCachedRuntimeForSessionPath,
  getOrCreateRuntimeForSessionPath,
  isRuntimeExtensionCommandRunning,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposal,
  withRuntimeMutationLock,
} from '../live-runtime-registry.ts'
import type { LivePiRuntime } from '../live-runtime-updates.ts'
import { publishThreadUpdate } from '../live-thread-publisher.ts'
import { emitComposerUpdate, scheduleRuntimeDisposalForRuntime } from './composer-updates.ts'

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

type SendComposerPromptRequest = ComposerStateRequest & {
  text: string
  attachments?: ComposerAttachment[]
  streamingBehavior?: ComposerStreamingBehavior | null
}

async function sendToRuntime(
  runtime: LivePiRuntime,
  persistedSessionPath: string | null,
  request: SendComposerPromptRequest,
) {
  try {
    const compactInstructions = parseCompactSlashCommand(request.text)
    if (compactInstructions !== null) {
      return await compactComposerRuntime({
        adapters: composerPromptAdapters,
        compactInstructions,
        persistedSessionPath,
        request,
        runtime,
      })
    }
    const message = buildComposerPromptMessage({
      attachments: request.attachments,
      text: expandRuntimeDollarSkillReferences(runtime, request.text),
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
    scheduleRuntimeDisposalForRuntime(runtime)
  }
}

export async function sendComposerPrompt(
  request: SendComposerPromptRequest,
): Promise<{ outcome: 'sent' | 'stopped'; sessionPath: string | null; threadId: string | null }> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath) {
    const runtime = await createRuntimeForNewSession(
      request.projectId ?? getDesktopWorkingDirectory(),
      request.composerSessionDir,
      { branchName: request.branchName ?? null, chatGroupId: request.chatGroupId ?? null },
    )
    await applyComposerModeSettings(runtime, request)
    return await sendToRuntime(runtime, null, request)
  }

  const cachedRuntime = await getCachedRuntimeForSessionPath(persistedSessionPath)
  if (
    cachedRuntime &&
    (cachedRuntime.session.isStreaming || isRuntimeExtensionCommandRunning(cachedRuntime))
  ) {
    cachedRuntime.branchName = request.branchName ?? cachedRuntime.branchName ?? null
    return await sendToRuntime(cachedRuntime, persistedSessionPath, request)
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
    return await sendToRuntime(runtime, persistedSessionPath, request)
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
