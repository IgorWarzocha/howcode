import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { supportsXhigh } from "@mariozechner/pi-ai";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type {
  ComposerContextUsage,
  ComposerModel,
  ComposerQueuedPrompt,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import { buildQueuedPrompts } from "./composer-queue";
import type { PiRuntime } from "./types.cts";

export const DEFAULT_COMPOSER_THINKING_LEVEL: ComposerThinkingLevel = "medium";

type ComposerSourceModel = NonNullable<AgentSession["model"]>;
type BuildComposerStateOptions = {
  includeContextUsage?: boolean;
};

const contextUsageCache = new WeakMap<AgentSession, ComposerContextUsage | null>();

function mapComposerModel(
  model: AgentSession["model"] | ComposerSourceModel | null | undefined,
): ComposerModel | null {
  if (!model) {
    return null;
  }

  return {
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.reasoning),
    input: (model.input ?? ["text"]) as Array<"text" | "image">,
  };
}

function mapThinkingLevels(levels: ThinkingLevel[]) {
  return levels as ComposerThinkingLevel[];
}

function buildSessionQueuedPrompts(session: AgentSession): ComposerQueuedPrompt[] {
  return buildQueuedPrompts({
    steering: [...session.getSteeringMessages()],
    followUp: [...session.getFollowUpMessages()],
  });
}

function mapContextUsage(session: AgentSession): ComposerContextUsage | null {
  const usage = session.getContextUsage();
  if (!usage) {
    contextUsageCache.set(session, null);
    return null;
  }

  const contextUsage = {
    tokens: usage.tokens,
    contextWindow: usage.contextWindow,
    percent: usage.percent,
  };
  contextUsageCache.set(session, contextUsage);
  return contextUsage;
}

function getContextUsageForComposerState(
  session: AgentSession,
  options: BuildComposerStateOptions = {},
) {
  const cachedUsage = contextUsageCache.get(session);
  if (options.includeContextUsage === false && cachedUsage !== undefined) {
    return cachedUsage;
  }

  return mapContextUsage(session);
}

export function getAvailableThinkingLevelsForModel(
  model: ComposerSourceModel | null,
): ComposerThinkingLevel[] {
  if (!model?.reasoning) {
    return ["off"];
  }

  return supportsXhigh(model)
    ? (["off", "minimal", "low", "medium", "high", "xhigh"] as ComposerThinkingLevel[])
    : (["off", "minimal", "low", "medium", "high"] as ComposerThinkingLevel[]);
}

export function clampThinkingLevel(
  level: ComposerThinkingLevel,
  availableLevels: ComposerThinkingLevel[],
): ComposerThinkingLevel {
  if (availableLevels.includes(level)) {
    return level;
  }

  const orderedLevels: ComposerThinkingLevel[] = [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ];
  const requestedIndex = orderedLevels.indexOf(level);

  if (requestedIndex === -1) {
    return availableLevels[0] ?? "off";
  }

  for (let index = requestedIndex; index >= 0; index -= 1) {
    const candidate = orderedLevels[index];
    if (availableLevels.includes(candidate)) {
      return candidate;
    }
  }

  return availableLevels[0] ?? "off";
}

function resolveCurrentModel(
  availableModels: ComposerSourceModel[],
  selectedModel: { provider: string; id: string } | null,
) {
  if (selectedModel) {
    const configuredModel = availableModels.find(
      (model) => model.provider === selectedModel.provider && model.id === selectedModel.id,
    );

    if (configuredModel) {
      return configuredModel;
    }
  }

  return availableModels[0] ?? null;
}

async function resolveComposerStateSnapshot(request: ComposerStateRequest = {}) {
  const { cwd, session } = await createComposerSnapshotSession(request);

  try {
    const availableModels = (await session.modelRegistry.getAvailable()) as ComposerSourceModel[];
    const currentModel = resolveCurrentModel(
      availableModels,
      session.model ? { provider: session.model.provider, id: session.model.id } : null,
    );
    const availableThinkingLevels = mapThinkingLevels(session.getAvailableThinkingLevels());

    return {
      cwd,
      availableModels,
      currentModel,
      currentThinkingLevel: clampThinkingLevel(
        session.thinkingLevel as ComposerThinkingLevel,
        availableThinkingLevels,
      ),
      availableThinkingLevels,
      contextUsage: mapContextUsage(session),
    };
  } finally {
    session.dispose();
  }
}

export async function createComposerSnapshotSession(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const {
    AuthStorage,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    createAgentSession,
    getAgentDir,
  } = await getPiModule();
  const cwd = persistedSessionPath
    ? SessionManager.open(persistedSessionPath).getCwd()
    : (request.projectId ?? getDesktopWorkingDirectory());
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const sessionManager = persistedSessionPath
    ? SessionManager.open(persistedSessionPath)
    : SessionManager.inMemory();
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager,
    tools: [],
  });

  return {
    cwd,
    session,
  };
}

export async function resolveComposerModel(request: ComposerStateRequest = {}) {
  const { session } = await createComposerSnapshotSession(request);

  try {
    return (session.model as ComposerSourceModel | null | undefined) ?? null;
  } finally {
    session.dispose();
  }
}

export async function buildComposerStateSnapshot(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  const snapshot = await resolveComposerStateSnapshot(request);

  return {
    currentModel: mapComposerModel(snapshot.currentModel),
    availableModels: snapshot.availableModels.map((model) => ({
      provider: model.provider,
      id: model.id,
      name: model.name ?? model.id,
      reasoning: Boolean(model.reasoning),
      input: (model.input ?? ["text"]) as Array<"text" | "image">,
    })),
    currentThinkingLevel: snapshot.currentThinkingLevel,
    availableThinkingLevels: snapshot.availableThinkingLevels,
    queuedPrompts: [],
    contextUsage: snapshot.contextUsage,
    isCompacting: false,
  };
}

export async function buildComposerState(
  runtime: PiRuntime,
  options: BuildComposerStateOptions = {},
): Promise<ComposerState> {
  const availableModels = (await runtime.session.modelRegistry.getAvailable()).map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.reasoning),
    input: (model.input ?? ["text"]) as Array<"text" | "image">,
  }));

  return {
    currentModel: mapComposerModel(runtime.session.model),
    availableModels,
    currentThinkingLevel: runtime.session.thinkingLevel as ComposerThinkingLevel,
    availableThinkingLevels: mapThinkingLevels(runtime.session.getAvailableThinkingLevels()),
    queuedPrompts: buildSessionQueuedPrompts(runtime.session),
    contextUsage: getContextUsageForComposerState(runtime.session, options),
    isCompacting: runtime.session.isCompacting,
  };
}
