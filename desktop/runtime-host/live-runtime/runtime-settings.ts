import type {
  ComposerStateRequest,
  ComposerThinkingLevel,
} from '../../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import { getPersistedSessionPath } from '../../../shared/session-paths.ts'
import { getPiModule } from '../../pi-module.ts'
import {
  setDraftComposerModel,
  setDraftComposerThinkingLevel,
} from '../../runtime/composer-mode-settings.ts'
import { setRuntimeProjectTrust } from '../../runtime/isolated-settings-manager.ts'
import {
  getOrCreateRuntimeForSessionPath,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposal,
  withRuntimeMutationLock,
} from '../live-runtime-registry.ts'
import { emitComposerUpdate } from './composer-updates.ts'

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
    const model = runtime.session.modelRuntime.getModel(provider, modelId)
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
