import type {
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { parseCompactSlashCommand } from "../../shared/composer-slash-commands.ts";
import { createLocalThreadDraft, getPersistedSessionPath } from "../../shared/session-paths.ts";
import { loadAppSettings } from "../app-settings/readers.cts";
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
  abortRuntimeExtensionCommand,
  isRuntimeExtensionCommandRunning,
} from "./runtime-registry.cts";
import {
  getLiveThread,
  publishComposerUpdate,
  publishThreadUpdate,
  subscribeDesktopEvents,
} from "./thread-publisher.cts";
import type { PiRuntime } from "./types.cts";

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

function isExtensionCommandPrompt(runtime: PiRuntime, text: string) {
  if (!text.startsWith("/")) return false;
  const commandName = text.slice(1).split(/\s+/, 1)[0];
  return Boolean(runtime.session.extensionRunner.getCommand(commandName));
}

async function applyComposerModeSettings(runtime: PiRuntime, request: ComposerStateRequest) {
  const selection = request.composerModelSelection ?? null;
  const thinkingLevel = request.composerThinkingLevel ?? null;
  let selectedModel = runtime.session.model;

  if (selection) {
    const model = runtime.session.modelRegistry.find(selection.provider, selection.id);
    if (model) {
      await runtime.session.setModel(model);
      selectedModel = model;
    } else {
      const [fallbackModel] = await runtime.session.modelRegistry.getAvailable();
      if (fallbackModel) {
        await runtime.session.setModel(fallbackModel);
        selectedModel = fallbackModel;
      }
    }
  } else if (request.composerUseDefaultModel) {
    const defaultComposer = await buildComposerStateSnapshot({
      projectId: runtime.cwd,
      composerSessionDir: request.composerSessionDir,
    });
    if (defaultComposer.currentModel) {
      const model = runtime.session.modelRegistry.find(
        defaultComposer.currentModel.provider,
        defaultComposer.currentModel.id,
      );
      if (model) {
        await runtime.session.setModel(model);
        selectedModel = model;
      }
    }
  }

  if (thinkingLevel) {
    runtime.session.setThinkingLevel(
      clampThinkingLevel(thinkingLevel, getAvailableThinkingLevelsForModel(selectedModel ?? null)),
    );
  } else if (Object.hasOwn(request, "composerThinkingLevel")) {
    const defaultComposer = await buildComposerStateSnapshot({
      projectId: runtime.cwd,
      composerSessionDir: request.composerSessionDir,
    });
    runtime.session.setThinkingLevel(
      clampThinkingLevel(
        defaultComposer.currentThinkingLevel,
        getAvailableThinkingLevelsForModel(selectedModel ?? null),
      ),
    );
  }
}

async function promptAndReturnAfterPreflight({
  runtime,
  message,
  options,
  request,
}: {
  runtime: PiRuntime;
  message: string;
  options?: Parameters<PiRuntime["session"]["prompt"]>[1];
  request: ComposerStateRequest;
}) {
  let resolvePreflight: (success: boolean) => void;
  const preflight = new Promise<boolean>((resolve) => {
    resolvePreflight = resolve;
  });

  const promptPromise = runtime.session.prompt(message, {
    ...options,
    preflightResult: (success) => resolvePreflight(success),
  });

  const accepted = await preflight;
  if (!accepted) {
    await promptPromise;
    return;
  }

  promptPromise
    .catch((error) => {
      console.error("Composer prompt failed after dispatch", error);
      void emitComposerUpdate({
        ...request,
        sessionPath: getPersistedSessionPath(runtime.session.sessionFile),
      });
    })
    .finally(() => {
      scheduleRuntimeDisposalForRuntime(runtime);
    });
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
  if (runtimePromise && persistedSessionPath) {
    return await withRuntimeMutationLock(persistedSessionPath, async () => {
      const runtime = await runtimePromise;
      if (!runtime.session.isStreaming && !isRuntimeExtensionCommandRunning(runtime)) {
        await applyComposerModeSettings(runtime, request);
      }
      return await buildComposerState(runtime);
    });
  }

  return await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath });
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

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    });
    const model = runtime.session.modelRegistry.find(provider, modelId);

    if (!model) {
      throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
    }

    await runtime.session.setModel(model);
    scheduleRuntimeDisposalForRuntime(runtime);
    return emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  });
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

  await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    });
    runtime.session.setThinkingLevel(level);
    scheduleRuntimeDisposalForRuntime(runtime);
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  });
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & {
    text: string;
    attachments?: ComposerAttachment[];
    streamingBehavior?: ComposerStreamingBehavior | null;
  },
): Promise<"sent" | "stopped"> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const compactInstructions = parseCompactSlashCommand(request.text);

  const runSend = async (runtime: Awaited<ReturnType<typeof getOrCreateRuntimeForSessionPath>>) => {
    if (compactInstructions !== null) {
      try {
        if (isRuntimeExtensionCommandRunning(runtime)) {
          throw new Error("Wait for the current extension command to finish before compacting.");
        }

        if (runtime.session.isStreaming) {
          throw new Error("Wait for the current response to finish before compacting.");
        }

        if (runtime.session.isCompacting) {
          throw new Error("Wait for the current compaction to finish before compacting again.");
        }

        const entries = runtime.session.sessionManager.getBranch();
        const messageCount = entries.filter((entry) => entry.type === "message").length;
        if (messageCount < 2) {
          throw new Error("Nothing to compact (no messages yet)");
        }

        await runtime.session.compact(
          compactInstructions.length > 0 ? compactInstructions : undefined,
        );

        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return "sent";
      } finally {
        scheduleRuntimeDisposalForRuntime(runtime);
      }
    }

    const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? []);
    const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ""}${request.text}`;
    const streamingBehavior =
      request.streamingBehavior ??
      request.composerStreamingBehavior ??
      loadAppSettings().composerStreamingBehavior;

    try {
      if (runtime.session.isCompacting) {
        throw new Error("Wait for the current compaction to finish before sending another prompt.");
      }

      if (runtime.session.isStreaming) {
        if (streamingBehavior === "stop") {
          if (!isExtensionCommandPrompt(runtime, request.text)) {
            await runtime.session.abort();
            await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
            return "stopped";
          }
        }

        const promptStreamingBehavior =
          streamingBehavior === "stop" ? "followUp" : streamingBehavior;
        await promptAndReturnAfterPreflight({
          runtime,
          message,
          options: { streamingBehavior: promptStreamingBehavior },
          request: { ...request, sessionPath: persistedSessionPath },
        });
      } else {
        await promptAndReturnAfterPreflight({
          runtime,
          message,
          request: { ...request, sessionPath: persistedSessionPath },
        });
      }

      await publishThreadUpdate(runtime, "update").catch((error) => {
        console.error("Composer prompt accepted but thread update publish failed", error);
      });
      return "sent";
    } catch (error) {
      scheduleRuntimeDisposalForRuntime(runtime);
      throw error;
    }
  };

  if (!persistedSessionPath) {
    const runtime = await createRuntimeForNewSession(
      request.projectId ?? getDesktopWorkingDirectory(),
      request.composerSessionDir,
      { chatGroupId: request.chatGroupId ?? null },
    );
    await applyComposerModeSettings(runtime, request);
    return await runSend(runtime);
  }

  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath);
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise;
    if (cachedRuntime.session.isStreaming || isRuntimeExtensionCommandRunning(cachedRuntime)) {
      return await runSend(cachedRuntime);
    }
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    });
    await applyComposerModeSettings(runtime, request);
    return await runSend(runtime);
  });
}

export async function stopComposerRun(request: ComposerStateRequest): Promise<void> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    return;
  }

  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath);
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise;
    const abortedExtensionCommand = abortRuntimeExtensionCommand(cachedRuntime);
    if (abortedExtensionCommand || cachedRuntime.session.isStreaming) {
      if (cachedRuntime.session.isStreaming) {
        await cachedRuntime.session.abort();
      }
      scheduleRuntimeDisposalForRuntime(cachedRuntime);
      await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
      return;
    }
  }

  await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    });

    const abortedExtensionCommand = abortRuntimeExtensionCommand(runtime);
    const wasStreaming = runtime.session.isStreaming;
    if (wasStreaming) {
      await runtime.session.abort();
    }
    if (!abortedExtensionCommand && !wasStreaming) await runtime.session.abort();
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
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
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
  const composer = await buildComposerStateSnapshot({ ...request, projectId, sessionPath: null });
  const draft = createLocalThreadDraft(projectId, undefined, { chatGroupId: request.chatGroupId });

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
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    const { composer } = await emitComposerUpdate({ ...request, sessionPath: null });
    return composer;
  }

  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
      settingsCwd: request.composerSessionDir ?? null,
      chatGroupId: request.chatGroupId ?? null,
    });
    if (!runtime.session.isStreaming && !isRuntimeExtensionCommandRunning(runtime)) {
      await applyComposerModeSettings(runtime, request);
    }
    scheduleRuntimeDisposalForRuntime(runtime);
    const composer = await buildComposerState(runtime);
    publishComposerUpdate(composer, {
      projectId: request.projectId ?? runtime.cwd,
      sessionPath: persistedSessionPath,
    });
    return composer;
  });
}
