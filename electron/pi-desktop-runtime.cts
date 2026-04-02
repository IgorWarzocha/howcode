import {
  type AgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";
import type {
  ComposerModel,
  ComposerState,
  ComposerThinkingLevel,
} from "../shared/desktop-contracts.js";

type DesktopPiRuntime = {
  session: AgentSession;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  settingsManager: SettingsManager;
};

let runtimePromise: Promise<DesktopPiRuntime> | undefined;

function mapComposerModel(model: AgentSession["model"]): ComposerModel | null {
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

function mapThinkingLevels(levels: string[]) {
  return levels as ComposerThinkingLevel[];
}

async function createRuntime(cwd: string): Promise<DesktopPiRuntime> {
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager: SessionManager.inMemory(),
  });

  return {
    session,
    authStorage,
    modelRegistry,
    settingsManager,
  };
}

async function getRuntime(cwd: string) {
  if (!runtimePromise) {
    runtimePromise = createRuntime(cwd);
  }

  return runtimePromise;
}

export async function getComposerState(cwd: string): Promise<ComposerState> {
  const runtime = await getRuntime(cwd);
  await runtime.session.reload();
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

export async function setComposerModel(cwd: string, provider: string, modelId: string) {
  const runtime = await getRuntime(cwd);
  const model = runtime.session.modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
  }

  await runtime.session.setModel(model);
}

export async function setComposerThinkingLevel(cwd: string, level: ComposerThinkingLevel) {
  const runtime = await getRuntime(cwd);
  runtime.session.setThinkingLevel(level);
}
