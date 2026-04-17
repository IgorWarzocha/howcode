import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { createLocalThreadDraft, getPersistedSessionPath } from "../../shared/session-paths.ts";
import { loadAppSettings } from "../app-settings.cts";
import { getPiModule } from "../pi-module.cts";
import { buildComposerAttachmentPrompt } from "./attachments.cts";
import {
  buildComposerQueueSnapshotKey,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from "./composer-queue";
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
  withRuntimeMutationLock,
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
    await setDraftComposerModel(
      request.projectId ?? getDesktopWorkingDirectory(),
      provider,
      modelId,
    );
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
    await setDraftComposerThinkingLevel(request.projectId ?? getDesktopWorkingDirectory(), level);
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
): Promise<"sent" | "stopped"> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);

  const runSend = async (runtime: Awaited<ReturnType<typeof getOrCreateRuntimeForSessionPath>>) => {
    const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? []);
    const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ""}${request.text}`;
    const streamingBehavior =
      request.streamingBehavior ?? loadAppSettings().composerStreamingBehavior;

    try {
      if (runtime.session.isStreaming) {
        if (streamingBehavior === "stop") {
          await runtime.session.abort();
          await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
          return "stopped";
        }

        await runtime.session.prompt(message, { streamingBehavior });
      } else {
        await runtime.session.prompt(message);
      }

      return "sent";
    } catch (error) {
      scheduleRuntimeDisposalForRuntime(runtime);
      throw error;
    }
  };

  if (!persistedSessionPath) {
    return await runSend(
      await createRuntimeForNewSession(request.projectId ?? getDesktopWorkingDirectory()),
    );
  }

  return await withRuntimeMutationLock(
    persistedSessionPath,
    async () =>
      await runSend(
        await getOrCreateRuntimeForSessionPath(persistedSessionPath, { suspendDisposal: true }),
      ),
  );
}

export async function stopComposerRun(request: ComposerStateRequest): Promise<void> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    return;
  }

  await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });

    await runtime.session.abort();
    scheduleRuntimeDisposalForRuntime(runtime);
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  });
}

export async function dequeueComposerPrompt(
  request: ComposerStateRequest & {
    queueId: string;
    queueSnapshotKey: string;
    queueMode: Exclude<ComposerStreamingBehavior, "stop">;
  },
): Promise<string | null> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    return null;
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });

    try {
      const currentQueueSnapshot = {
        steering: [...runtime.session.getSteeringMessages()],
        followUp: [...runtime.session.getFollowUpMessages()],
      };

      if (buildComposerQueueSnapshotKey(currentQueueSnapshot) !== request.queueSnapshotKey) {
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return null;
      }

      const currentQueue =
        request.queueMode === "steer"
          ? currentQueueSnapshot.steering
          : currentQueueSnapshot.followUp;
      if (findQueuedPromptIndexById(request.queueMode, currentQueue, request.queueId) === null) {
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return null;
      }

      const clearedQueue = runtime.session.clearQueue();
      const dequeueResult = removeQueuedPromptById(
        clearedQueue,
        request.queueMode,
        request.queueId,
      );

      if (!dequeueResult) {
        await replayComposerQueue(runtime.session, clearedQueue);
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return null;
      }

      try {
        await replayComposerQueue(runtime.session, dequeueResult.nextQueue);
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return dequeueResult.dequeuedText;
      } catch (error) {
        runtime.session.clearQueue();

        try {
          await replayComposerQueue(runtime.session, clearedQueue);
          await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        } catch (rollbackError) {
          throw new Error(
            rollbackError instanceof Error
              ? `Could not restore queued prompts after dequeue replay failure: ${rollbackError.message}`
              : "Could not restore queued prompts after dequeue replay failure.",
          );
        }

        throw error;
      }
    } finally {
      scheduleRuntimeDisposalForRuntime(runtime);
    }
  });
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  const projectId = request.projectId ?? getDesktopWorkingDirectory();
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
