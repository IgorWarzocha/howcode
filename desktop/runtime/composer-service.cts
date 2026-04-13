import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { createLocalThreadDraft, getPersistedSessionPath } from "../../shared/session-paths.ts";
import { prepareTurnDiffCapture } from "../diff/query.cts";
import { getPiModule } from "../pi-module.cts";
import { buildComposerAttachmentPrompt } from "./attachments.cts";
import {
  buildComposerState,
  buildComposerStateSnapshot,
  clampThinkingLevel,
  getAvailableThinkingLevelsForModel,
} from "./composer-state.cts";
import {
  createRuntimeForNewSession,
  getCachedRuntimeForSessionPath,
  getOrCreateRuntimeForSessionPath,
  scheduleRuntimeDisposalForRuntime,
} from "./runtime-registry.cts";
import {
  getLiveThread,
  publishComposerUpdate,
  subscribeDesktopEvents,
} from "./thread-publisher.cts";

async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null;
  const runtime = runtimePromise ? await runtimePromise : null;
  const composer = runtime
    ? await buildComposerState(runtime)
    : await buildComposerStateSnapshot({
        ...request,
        sessionPath: persistedSessionPath,
      });

  publishComposerUpdate(composer, {
    projectId: request.projectId ?? null,
    sessionPath: persistedSessionPath,
  });

  return {
    composer,
    runtime,
  };
}

async function setDraftComposerModel(cwd: string, provider: string, modelId: string) {
  const { AuthStorage, ModelRegistry, SettingsManager, getAgentDir } = await getPiModule();
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const model = modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
  }

  const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null });
  const nextThinkingLevel = clampThinkingLevel(
    currentComposer.currentThinkingLevel,
    getAvailableThinkingLevelsForModel(model),
  );
  const settingsManager = SettingsManager.create(cwd, agentDir);

  settingsManager.setDefaultModelAndProvider(provider, modelId);
  settingsManager.setDefaultThinkingLevel(nextThinkingLevel);
}

async function setDraftComposerThinkingLevel(cwd: string, level: ComposerThinkingLevel) {
  const { SettingsManager, getAgentDir } = await getPiModule();
  const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null });
  SettingsManager.create(cwd, getAgentDir()).setDefaultThinkingLevel(
    clampThinkingLevel(level, currentComposer.availableThinkingLevels),
  );
}

export { getLiveThread, subscribeDesktopEvents };

export async function getComposerState(request: ComposerStateRequest = {}): Promise<ComposerState> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null;

  // Reads should reflect the current in-memory runtime state. Reloading or publishing here can
  // race with just-applied composer mutations and re-broadcast stale snapshots back into the UI.
  return runtimePromise
    ? await buildComposerState(await runtimePromise)
    : await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath });
}

export async function setComposerModel(
  request: ComposerStateRequest,
  provider: string,
  modelId: string,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);

  if (!persistedSessionPath) {
    await setDraftComposerModel(request.projectId ?? process.cwd(), provider, modelId);
    return emitComposerUpdate({ ...request, sessionPath: null });
  }

  const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
    suspendDisposal: true,
  });
  const model = runtime.session.modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
  }

  await runtime.session.setModel(model);
  scheduleRuntimeDisposalForRuntime(runtime);
  return emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);

  if (!persistedSessionPath) {
    await setDraftComposerThinkingLevel(request.projectId ?? process.cwd(), level);
    return emitComposerUpdate({ ...request, sessionPath: null });
  }

  const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
    suspendDisposal: true,
  });
  runtime.session.setThinkingLevel(level);
  scheduleRuntimeDisposalForRuntime(runtime);
  return emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & { text: string; attachments?: ComposerAttachment[] },
): Promise<void> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const runtime = persistedSessionPath
    ? await getOrCreateRuntimeForSessionPath(persistedSessionPath, { suspendDisposal: true })
    : await createRuntimeForNewSession(request.projectId ?? process.cwd());
  const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? []);
  const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ""}${request.text}`;

  try {
    await prepareTurnDiffCapture(runtime);
  } catch (error) {
    runtime.pendingTurnCount = null;
    console.warn("Failed to prepare turn diff capture.", error);
  }

  try {
    await runtime.session.prompt(message);
  } catch (error) {
    runtime.pendingTurnCount = null;
    scheduleRuntimeDisposalForRuntime(runtime);
    throw error;
  }
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  const projectId = request.projectId ?? process.cwd();
  const composer = await buildComposerStateSnapshot({ projectId, sessionPath: null });
  const draft = createLocalThreadDraft(projectId);

  publishComposerUpdate(composer, { projectId, sessionPath: null });

  return {
    composer,
    projectId,
    sessionPath: draft.sessionPath,
    threadId: draft.threadId,
  };
}

export async function selectProjectRuntime(
  request: ComposerStateRequest = {},
): Promise<ComposerState> {
  const { composer } = await emitComposerUpdate({ ...request, sessionPath: null });
  return composer;
}

export async function openThreadRuntime(request: ComposerStateRequest): Promise<ComposerState> {
  const { composer } = await emitComposerUpdate({
    ...request,
    sessionPath: getPersistedSessionPath(request.sessionPath),
  });
  return composer;
}
