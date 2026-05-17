import type { ComposerStateRequest, ComposerThinkingLevel } from '../../shared/desktop-contracts.ts'
import { getPiModule } from '../pi-module.ts'
import {
  buildComposerStateSnapshot,
  clampThinkingLevel,
  createComposerSnapshotSession,
  getAvailableThinkingLevelsForModel,
} from './composer-state.ts'
import type { PiRuntime } from './types.ts'

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

export async function applyComposerModeSettings(runtime: PiRuntime, request: ComposerStateRequest) {
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

export async function setDraftComposerModel(input: {
  cwd: string
  modelId: string
  provider: string
  request: ComposerStateRequest
}) {
  const { SettingsManager, getAgentDir } = await getPiModule()
  const agentDir = getAgentDir()
  const snapshot = await createComposerSnapshotSession({
    ...input.request,
    projectId: input.cwd,
    sessionPath: null,
  })

  try {
    const model = snapshot.session.modelRegistry.find(input.provider, input.modelId)
    if (!model) throw new Error(`Unknown Pi model: ${input.provider}/${input.modelId}`)

    const currentComposer = await buildComposerStateSnapshot({
      ...input.request,
      projectId: input.cwd,
      sessionPath: null,
    })
    const settingsManager = SettingsManager.create(input.cwd, agentDir)
    settingsManager.setDefaultModelAndProvider(input.provider, input.modelId)
    settingsManager.setDefaultThinkingLevel(
      clampThinkingLevel(
        currentComposer.currentThinkingLevel,
        getAvailableThinkingLevelsForModel(model),
      ),
    )
  } finally {
    snapshot.session.dispose()
  }
}

export async function setDraftComposerThinkingLevel(input: {
  cwd: string
  level: ComposerThinkingLevel
}) {
  const { SettingsManager, getAgentDir } = await getPiModule()
  const currentComposer = await buildComposerStateSnapshot({
    projectId: input.cwd,
    sessionPath: null,
  })
  SettingsManager.create(input.cwd, getAgentDir()).setDefaultThinkingLevel(
    clampThinkingLevel(input.level, currentComposer.availableThinkingLevels),
  )
}
