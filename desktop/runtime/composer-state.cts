import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { type Model, supportsXhigh } from "@mariozechner/pi-ai";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type {
  ComposerModel,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import type { PiRuntime } from "./types.cts";

export const DEFAULT_COMPOSER_THINKING_LEVEL: ComposerThinkingLevel = "medium";

type ComposerSourceModel = NonNullable<AgentSession["model"]>;

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
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const { AuthStorage, ModelRegistry, SessionManager, SettingsManager, getAgentDir } =
    await getPiModule();
  const cwd = persistedSessionPath
    ? SessionManager.open(persistedSessionPath).getCwd()
    : (request.projectId ?? process.cwd());
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const availableModels = await modelRegistry.getAvailable();

  let selectedModel: { provider: string; id: string } | null = null;
  let selectedThinkingLevel: ComposerThinkingLevel | null = null;

  if (persistedSessionPath) {
    const sessionContext = SessionManager.open(persistedSessionPath).buildSessionContext();
    selectedModel = sessionContext.model
      ? { provider: sessionContext.model.provider, id: sessionContext.model.modelId }
      : null;
    selectedThinkingLevel = sessionContext.thinkingLevel as ComposerThinkingLevel;
  } else {
    const provider = settingsManager.getDefaultProvider();
    const modelId = settingsManager.getDefaultModel();
    selectedModel = provider && modelId ? { provider, id: modelId } : null;
    selectedThinkingLevel =
      (settingsManager.getDefaultThinkingLevel() as ComposerThinkingLevel | undefined) ??
      DEFAULT_COMPOSER_THINKING_LEVEL;
  }

  const currentModel = resolveCurrentModel(availableModels, selectedModel);
  const availableThinkingLevels = getAvailableThinkingLevelsForModel(currentModel);

  return {
    cwd,
    availableModels,
    currentModel,
    currentThinkingLevel: clampThinkingLevel(
      selectedThinkingLevel ?? DEFAULT_COMPOSER_THINKING_LEVEL,
      availableThinkingLevels,
    ),
    availableThinkingLevels,
  };
}

export async function resolveComposerModel(request: ComposerStateRequest = {}) {
  return (await resolveComposerStateSnapshot(request)).currentModel;
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
  };
}

export async function buildComposerState(runtime: PiRuntime): Promise<ComposerState> {
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
  };
}
