import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { createLocalThreadDraft, getPersistedSessionPath } from "../../shared/session-paths.ts";
import { loadAppSettings } from "../app-settings.cts";
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
  request: ComposerStateRequest & {
    text: string;
    attachments?: ComposerAttachment[];
    streamingBehavior?: ComposerStreamingBehavior | null;
  },
): Promise<void> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const runtime = persistedSessionPath
    ? await getOrCreateRuntimeForSessionPath(persistedSessionPath, { suspendDisposal: true })
    : await createRuntimeForNewSession(request.projectId ?? process.cwd());
  const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? []);
  const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ""}${request.text}`;
  const streamingBehavior =
    request.streamingBehavior ?? loadAppSettings().composerStreamingBehavior;

  try {
    if (runtime.session.isStreaming) {
      if (streamingBehavior === "stop") {
        await runtime.session.abort();
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return;
      }

      await runtime.session.prompt(message, { streamingBehavior });
    } else {
      await runtime.session.prompt(message);
    }
  } catch (error) {
    scheduleRuntimeDisposalForRuntime(runtime);
    throw error;
  }
}

export async function stopComposerRun(request: ComposerStateRequest): Promise<void> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    return;
  }

  const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
    suspendDisposal: true,
  });

  await runtime.session.abort();
  scheduleRuntimeDisposalForRuntime(runtime);
  await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
}

export async function dequeueComposerPrompt(
  request: ComposerStateRequest & {
    queueMode: Exclude<ComposerStreamingBehavior, "stop">;
    queueIndex: number;
  },
): Promise<string | null> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    return null;
  }

  const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
    suspendDisposal: true,
  });
  const currentQueue =
    request.queueMode === "steer"
      ? runtime.session.getSteeringMessages()
      : runtime.session.getFollowUpMessages();

  if (request.queueIndex < 0 || request.queueIndex >= currentQueue.length) {
    return null;
  }

  const clearedQueue = runtime.session.clearQueue();
  const targetQueue = request.queueMode === "steer" ? clearedQueue.steering : clearedQueue.followUp;

  const [dequeuedText] = targetQueue.splice(request.queueIndex, 1);

  if (runtime.session.isStreaming) {
    for (const queuedText of clearedQueue.steering) {
      await runtime.session.steer(queuedText);
    }

    for (const queuedText of clearedQueue.followUp) {
      await runtime.session.followUp(queuedText);
    }
  }

  scheduleRuntimeDisposalForRuntime(runtime);
  await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  return dequeuedText ?? null;
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
