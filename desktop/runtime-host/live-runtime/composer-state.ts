import type { ComposerStateRequest } from '../../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import { createLocalThreadDraft, getPersistedSessionPath } from '../../../shared/session-paths.ts'
import { applyComposerModeSettings } from '../../runtime/composer-mode-settings.ts'
import { mapSessionSkills } from '../../runtime/composer-skill-references.ts'
import { buildComposerState, buildComposerStateSnapshot } from '../../runtime/composer-state.ts'
import { getComposerSessionResources } from '../composer-resource-service.ts'
import {
  getOrCreateRuntimeForSessionPath,
  isRuntimeExtensionCommandRunning,
  scheduleRuntimeDisposal,
  withRuntimeMutationLock,
} from '../live-runtime-registry.ts'
import { publishComposerUpdate } from '../live-thread-publisher.ts'
import { mapSessionCommands } from '../slash-command-service.ts'
import { emitComposerUpdate } from './composer-updates.ts'

export async function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  return await getComposerSessionResources(request, mapSessionCommands)
}

export async function getComposerSkills(request: ComposerStateRequest = {}) {
  return await getComposerSessionResources(request, mapSessionSkills)
}

export async function getComposerState(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  if (!persistedSessionPath)
    return await buildComposerStateSnapshot({ ...request, sessionPath: null })

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
