import type { ThinkingLevel } from '@earendil-works/pi-agent-core'
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai'
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { composerThinkingLevels } from '../../shared/composer-thinking-level.ts'
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerQueuedPrompt,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import {
  normalizeModelContextWindowValue,
  normalizeModelRuntimeContextWindows,
} from '../../shared/model-context-window-normalization.ts'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { getPiModule } from '../pi-module.ts'
import { isHeadlessExtensionCommandRunning } from './agent-session-extensions.ts'
import { getBundledSkillPaths } from './bundled-skills.ts'
import { getRuntimeSystemPrompt } from './chat-system-prompt.ts'
import { buildQueuedPrompts } from './composer-queue'
import {
  createIsolatedRuntimeResourceLoader,
  createRuntimeSettingsManager,
  getRuntimeDefaultProjectTrust,
  getRuntimeProjectTrustRequest,
  resolveRuntimeProjectTrust,
} from './isolated-settings-manager.ts'
import {
  getPiExtensionDialog,
  getPiExtensionShortcuts,
  getPiExtensionStatuses,
  getPiExtensionWidgets,
} from './pi-extension-ui-state.ts'
import type { PiRuntime } from './types.ts'

export const DEFAULT_COMPOSER_THINKING_LEVEL: ComposerThinkingLevel = 'medium'

type ComposerSourceModel = NonNullable<AgentSession['model']>
type BuildComposerStateOptions = {
  includeContextUsage?: boolean | undefined
}

const contextUsageCache = new WeakMap<AgentSession, ComposerContextUsage | null>()

function mapComposerModel(
  model: AgentSession['model'] | ComposerSourceModel | null | undefined,
): ComposerModel | null {
  if (!model) {
    return null
  }

  return {
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.reasoning),
    input: model.input ?? ['text'],
  }
}

function mapThinkingLevels(levels: ThinkingLevel[]) {
  return levels
}

function buildSessionQueuedPrompts(session: AgentSession): ComposerQueuedPrompt[] {
  return buildQueuedPrompts({
    steering: [...session.getSteeringMessages()],
    followUp: [...session.getFollowUpMessages()],
  })
}

function mapContextUsage(session: AgentSession): ComposerContextUsage | null {
  const usage = session.getContextUsage()
  if (!usage) {
    contextUsageCache.set(session, null)
    return null
  }

  const contextWindow = normalizeModelContextWindowValue(usage.contextWindow)
  const contextUsage = {
    tokens: usage.tokens,
    contextWindow,
    percent: usage.tokens === null ? usage.percent : (usage.tokens / contextWindow) * 100,
    latestCacheHitRate: getLatestCacheHitRate(session),
  }
  contextUsageCache.set(session, contextUsage)
  return contextUsage
}

function getLatestCacheHitRate(session: AgentSession) {
  let latestCacheHitRate: number | null = null

  for (const entry of session.sessionManager.getBranch()) {
    if (entry.type !== 'message' || entry.message.role !== 'assistant') continue

    const usage = entry.message.usage
    if (!usage) continue
    const latestPromptTokens = usage.input + usage.cacheRead + usage.cacheWrite
    latestCacheHitRate =
      latestPromptTokens > 0 ? (usage.cacheRead / latestPromptTokens) * 100 : null
  }

  return latestCacheHitRate
}

function getContextUsageForComposerState(
  session: AgentSession,
  options: BuildComposerStateOptions = {},
) {
  const cachedUsage = contextUsageCache.get(session)
  if (options.includeContextUsage === false && cachedUsage !== undefined) {
    return cachedUsage
  }

  return mapContextUsage(session)
}

export function getAvailableThinkingLevelsForModel(
  model: ComposerSourceModel | null,
): ComposerThinkingLevel[] {
  if (!model?.reasoning) {
    return ['off']
  }

  return getSupportedThinkingLevels(model)
}

export function clampThinkingLevel(
  level: ComposerThinkingLevel,
  availableLevels: ComposerThinkingLevel[],
): ComposerThinkingLevel {
  const availableLevelSet = new Set(availableLevels)
  if (availableLevelSet.has(level)) {
    return level
  }

  const requestedIndex = composerThinkingLevels.indexOf(level)

  if (requestedIndex === -1) {
    return availableLevels[0] ?? 'off'
  }

  for (let index = requestedIndex; index >= 0; index -= 1) {
    const candidate = composerThinkingLevels[index]
    if (candidate && availableLevelSet.has(candidate)) {
      return candidate
    }
  }

  return availableLevels[0] ?? 'off'
}

function resolveCurrentModel(
  availableModels: ComposerSourceModel[],
  selectedModel: { provider: string; id: string } | null,
) {
  if (selectedModel) {
    const configuredModel = availableModels.find(
      (model) => model.provider === selectedModel.provider && model.id === selectedModel.id,
    )

    if (configuredModel) {
      return configuredModel
    }
  }

  return availableModels[0] ?? null
}

function getModeModelSelection(request: ComposerStateRequest) {
  return request.composerModelSelection ?? null
}

function getModeThinkingLevel(request: ComposerStateRequest) {
  return request.composerThinkingLevel ?? null
}

async function resolveComposerStateSnapshot(request: ComposerStateRequest = {}) {
  const { cwd, projectTrustServices, session } = await createComposerSnapshotSession(request)

  try {
    const availableModels = (await session.modelRuntime.getAvailable()) as ComposerSourceModel[]
    const requestedModeModelSelection = getModeModelSelection(request)
    const modeModelSelection = requestedModeModelSelection?.provider
      ? { provider: requestedModeModelSelection.provider, id: requestedModeModelSelection.id }
      : null
    const currentModel = resolveCurrentModel(
      availableModels,
      modeModelSelection ??
        (session.model ? { provider: session.model.provider, id: session.model.id } : null),
    )
    const availableThinkingLevels = modeModelSelection
      ? getAvailableThinkingLevelsForModel(currentModel)
      : mapThinkingLevels(session.getAvailableThinkingLevels())
    const currentThinkingLevel = getModeThinkingLevel(request) ?? session.thinkingLevel

    return {
      cwd,
      availableModels,
      currentModel,
      currentThinkingLevel: clampThinkingLevel(
        currentThinkingLevel as ComposerThinkingLevel,
        availableThinkingLevels,
      ),
      availableThinkingLevels,
      contextUsage: mapContextUsage(session),
      projectTrustRequest: getRuntimeProjectTrustRequest({
        ...projectTrustServices,
        cwd,
      }),
    }
  } finally {
    session.dispose()
  }
}

export async function createComposerSnapshotSession(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath)
  const {
    ModelRuntime,
    SessionManager,
    SettingsManager,
    DefaultResourceLoader,
    ProjectTrustStore,
    createAgentSession,
    getAgentDir,
    hasTrustRequiringProjectResources,
  } = await getPiModule()
  const cwd = persistedSessionPath
    ? SessionManager.open(persistedSessionPath).getCwd()
    : (request.projectId ?? getDesktopWorkingDirectory())
  const agentDir = getAgentDir()
  const defaultProjectTrust = getRuntimeDefaultProjectTrust({ SettingsManager, agentDir, cwd })
  const projectTrusted = resolveRuntimeProjectTrust({
    ProjectTrustStore,
    agentDir,
    cwd,
    defaultProjectTrust,
    hasTrustRequiringProjectResources,
    settingsCwd: request.composerSessionDir,
  })
  const modelRuntime = normalizeModelRuntimeContextWindows(
    await ModelRuntime.create({
      authPath: `${agentDir}/auth.json`,
      modelsPath: `${agentDir}/models.json`,
    }),
  )
  const settingsManager = createRuntimeSettingsManager({
    SettingsManager,
    cwd,
    agentDir,
    settingsCwd: request.composerSessionDir,
    projectTrusted,
  })
  const sessionManager = persistedSessionPath
    ? SessionManager.open(persistedSessionPath)
    : SessionManager.inMemory()
  const resourceLoader = await createIsolatedRuntimeResourceLoader({
    DefaultResourceLoader,
    additionalSkillPaths: getBundledSkillPaths(),
    cwd,
    agentDir,
    settingsCwd: request.composerSessionDir,
    settingsManager,
    projectTrusted,
    systemPrompt: getRuntimeSystemPrompt({ settingsCwd: request.composerSessionDir }),
  })
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime,
    settingsManager,
    resourceLoader,
    sessionManager,
    tools: [],
  })

  return {
    cwd,
    projectTrustServices: { ProjectTrustStore, agentDir, hasTrustRequiringProjectResources },
    session,
  }
}

export async function resolveComposerModel(request: ComposerStateRequest = {}) {
  const { session } = await createComposerSnapshotSession(request)

  try {
    return (session.model as ComposerSourceModel | null | undefined) ?? null
  } finally {
    session.dispose()
  }
}

export async function buildComposerStateSnapshot(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  const snapshot = await resolveComposerStateSnapshot(request)

  return {
    currentModel: mapComposerModel(snapshot.currentModel),
    availableModels: snapshot.availableModels.map((model) => ({
      provider: model.provider,
      id: model.id,
      name: model.name ?? model.id,
      reasoning: Boolean(model.reasoning),
      input: model.input ?? ['text'],
    })),
    currentThinkingLevel: snapshot.currentThinkingLevel,
    availableThinkingLevels: snapshot.availableThinkingLevels,
    queuedPrompts: [],
    piExtensionWidgets: [],
    piExtensionStatuses: [],
    piExtensionShortcuts: [],
    piExtensionDialogRequest: null,
    projectTrustRequest: snapshot.projectTrustRequest,
    contextUsage: snapshot.contextUsage,
    isCompacting: false,
    isExtensionCommandRunning: false,
  }
}

export async function buildComposerState(
  runtime: PiRuntime,
  options: BuildComposerStateOptions = {},
): Promise<ComposerState> {
  const { ProjectTrustStore, SettingsManager, getAgentDir, hasTrustRequiringProjectResources } =
    await getPiModule()
  const agentDir = getAgentDir()
  const defaultProjectTrust = getRuntimeDefaultProjectTrust({
    SettingsManager,
    agentDir,
    cwd: runtime.cwd,
  })
  const availableModels = (await runtime.session.modelRuntime.getAvailable()).map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.reasoning),
    input: model.input ?? ['text'],
  }))

  return {
    currentModel: mapComposerModel(runtime.session.model),
    availableModels,
    currentThinkingLevel: runtime.session.thinkingLevel,
    availableThinkingLevels: mapThinkingLevels(runtime.session.getAvailableThinkingLevels()),
    queuedPrompts: buildSessionQueuedPrompts(runtime.session),
    piExtensionWidgets: getPiExtensionWidgets(runtime),
    piExtensionStatuses: getPiExtensionStatuses(runtime),
    piExtensionShortcuts: getPiExtensionShortcuts(runtime),
    piExtensionDialogRequest: getPiExtensionDialog(runtime),
    projectTrustRequest: getRuntimeProjectTrustRequest({
      ProjectTrustStore,
      agentDir,
      cwd: runtime.cwd,
      defaultProjectTrust,
      hasTrustRequiringProjectResources,
    }),
    contextUsage: getContextUsageForComposerState(runtime.session, options),
    isCompacting: runtime.session.isCompacting,
    isExtensionCommandRunning: isHeadlessExtensionCommandRunning(runtime.session),
  }
}
