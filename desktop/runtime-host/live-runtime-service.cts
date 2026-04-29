import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
} from "../../shared/desktop-contracts.ts";
import { parseCompactSlashCommand } from "../../shared/composer-slash-commands.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { createLocalThreadDraft, getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import { loadAppSettings } from "../app-settings.cts";
import { discoverHeadlessAgentSessionResources } from "../runtime/agent-session-extensions.cts";
import { buildComposerAttachmentPrompt } from "../runtime/attachments.cts";
import {
  buildComposerQueueSnapshotKey,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from "../runtime/composer-queue";
import {
  buildComposerState,
  buildComposerStateSnapshot,
  createComposerSnapshotSession,
  clampThinkingLevel,
  getAvailableThinkingLevelsForModel,
} from "../runtime/composer-state.cts";
import type { PiRuntime } from "../runtime/types.cts";
import { publishComposerUpdate, publishThreadUpdate } from "./live-thread-publisher.cts";
import {
  createRuntimeForNewSession,
  getCachedRuntimeForSessionPath,
  getOrCreateRuntimeForSessionPath,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposal,
  withRuntimeMutationLock,
  abortRuntimeExtensionCommand,
  isRuntimeExtensionCommandRunning,
} from "./live-runtime-registry.cts";
import { mapSessionCommands } from "./slash-command-service.cts";

async function emitComposerUpdate(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null;
  const runtime = runtimePromise ? await runtimePromise : null;
  const composer = runtime
    ? await buildComposerState(runtime)
    : await buildComposerStateSnapshot({ ...request, sessionPath: persistedSessionPath });
  publishComposerUpdate(composer, {
    projectId: request.projectId ?? null,
    sessionPath: persistedSessionPath,
  });
  return { composer, runtime };
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
      const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
      if (runtimeKey) scheduleRuntimeDisposal(runtimeKey);
    });
}

export async function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (persistedSessionPath) {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });
    await reloadRuntimeSettingsIfSafe(persistedSessionPath);
    scheduleRuntimeDisposal(persistedSessionPath);
    return mapSessionCommands(runtime.session);
  }

  const snapshot = await createComposerSnapshotSession({
    projectId: request.projectId ?? getDesktopWorkingDirectory(),
    sessionPath: persistedSessionPath,
  });

  try {
    await discoverHeadlessAgentSessionResources(snapshot.session).catch((error) => {
      console.warn("Pi extension resource discovery failed", error);
    });
    return mapSessionCommands(snapshot.session);
  } finally {
    snapshot.session.dispose();
  }
}

export async function getComposerState(request: ComposerStateRequest = {}) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (persistedSessionPath) {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });
    scheduleRuntimeDisposal(persistedSessionPath);
    return await buildComposerState(runtime);
  }

  return await buildComposerStateSnapshot({ ...request, sessionPath: null });
}

export async function setComposerModel(
  request: ComposerStateRequest,
  provider: string,
  modelId: string,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    const { AuthStorage, ModelRegistry, SettingsManager, getAgentDir } = await getPiModule();
    const cwd = request.projectId ?? getDesktopWorkingDirectory();
    const agentDir = getAgentDir();
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
    const model = modelRegistry.find(provider, modelId);
    if (!model) throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
    const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null });
    const settingsManager = SettingsManager.create(cwd, agentDir);
    settingsManager.setDefaultModelAndProvider(provider, modelId);
    settingsManager.setDefaultThinkingLevel(
      clampThinkingLevel(
        currentComposer.currentThinkingLevel,
        getAvailableThinkingLevelsForModel(model),
      ),
    );
    await emitComposerUpdate({ ...request, sessionPath: null });
    return { ok: true as const };
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false });
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });
    const model = runtime.session.modelRegistry.find(provider, modelId);
    if (!model) throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
    await runtime.session.setModel(model);
    scheduleRuntimeDisposal(persistedSessionPath);
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  });
  return { ok: true as const };
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    const { SettingsManager, getAgentDir } = await getPiModule();
    const cwd = request.projectId ?? getDesktopWorkingDirectory();
    const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null });
    SettingsManager.create(cwd, getAgentDir()).setDefaultThinkingLevel(
      clampThinkingLevel(level, currentComposer.availableThinkingLevels),
    );
    await emitComposerUpdate({ ...request, sessionPath: null });
    return { ok: true as const };
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false });
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });
    runtime.session.setThinkingLevel(level);
    scheduleRuntimeDisposal(persistedSessionPath);
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  });
  return { ok: true as const };
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
  const runSend = async (runtime: PiRuntime) => {
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
    try {
      if (compactInstructions !== null) {
        if (runtime.session.isStreaming)
          throw new Error("Wait for the current response to finish before compacting.");
        if (runtime.session.isCompacting)
          throw new Error("Wait for the current compaction to finish before compacting again.");
        const entries = runtime.session.sessionManager.getBranch();
        if (entries.filter((entry) => entry.type === "message").length < 2)
          throw new Error("Nothing to compact (no messages yet)");
        await runtime.session.compact(
          compactInstructions.length > 0 ? compactInstructions : undefined,
        );
        await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
        return "sent" as const;
      }
      const attachmentPrompt = buildComposerAttachmentPrompt(request.attachments ?? []);
      const message = `${attachmentPrompt ? `${attachmentPrompt}\n\n` : ""}${request.text}`;
      const streamingBehavior =
        request.streamingBehavior ?? loadAppSettings().composerStreamingBehavior;
      if (runtime.session.isCompacting)
        throw new Error("Wait for the current compaction to finish before sending another prompt.");
      if (runtime.session.isStreaming) {
        if (streamingBehavior === "stop") {
          await runtime.session.abort();
          await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
          return "stopped" as const;
        }
        await promptAndReturnAfterPreflight({
          runtime,
          message,
          options: { streamingBehavior },
          request: { ...request, sessionPath: persistedSessionPath },
        });
      } else {
        await promptAndReturnAfterPreflight({
          runtime,
          message,
          request: { ...request, sessionPath: persistedSessionPath },
        });
      }
      await publishThreadUpdate(runtime, "update").catch((error) =>
        console.error("Composer prompt accepted but thread update publish failed", error),
      );
      return "sent" as const;
    } finally {
      if (runtimeKey) scheduleRuntimeDisposal(runtimeKey);
    }
  };
  if (!persistedSessionPath)
    return await runSend(
      await createRuntimeForNewSession(request.projectId ?? getDesktopWorkingDirectory()),
    );
  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath);
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise;
    if (cachedRuntime.session.isStreaming || isRuntimeExtensionCommandRunning(cachedRuntime)) {
      return await runSend(cachedRuntime);
    }
  }
  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false });
    return await runSend(
      await getOrCreateRuntimeForSessionPath(persistedSessionPath, { suspendDisposal: true }),
    );
  });
}

export async function stopComposerRun(request: ComposerStateRequest) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) return { ok: true as const };
  const cachedRuntimePromise = getCachedRuntimeForSessionPath(persistedSessionPath);
  if (cachedRuntimePromise) {
    const cachedRuntime = await cachedRuntimePromise;
    const abortedExtensionCommand = abortRuntimeExtensionCommand(cachedRuntime);
    const wasStreaming = cachedRuntime.session.isStreaming;
    if (wasStreaming) {
      await cachedRuntime.session.abort();
    }
    if (abortedExtensionCommand || wasStreaming) {
      scheduleRuntimeDisposal(persistedSessionPath);
      await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
      return { ok: true as const };
    }
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false });
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });
    const abortedExtensionCommand = abortRuntimeExtensionCommand(runtime);
    if (runtime.session.isStreaming) {
      await runtime.session.abort();
    }
    if (!abortedExtensionCommand && !runtime.session.isStreaming) await runtime.session.abort();
    scheduleRuntimeDisposal(persistedSessionPath);
    await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
  });
  return { ok: true as const };
}

export async function dequeueComposerPrompt(
  request: ComposerStateRequest & {
    queueId: string;
    queueSnapshotKey: string;
    queueMode: Exclude<ComposerStreamingBehavior, "stop">;
  },
) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) return null;
  return await withRuntimeMutationLock(persistedSessionPath, async () => {
    await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false });
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
      scheduleRuntimeDisposal(persistedSessionPath);
    }
  });
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  const projectId = request.projectId ?? getDesktopWorkingDirectory();
  const composer = await buildComposerStateSnapshot({ projectId, sessionPath: null });
  const draft = createLocalThreadDraft(projectId);
  publishComposerUpdate(composer, { projectId, sessionPath: null });
  return { composer, projectId, sessionPath: draft.sessionPath, threadId: draft.threadId };
}

export async function selectProjectRuntime(request: ComposerStateRequest = {}) {
  const { composer } = await emitComposerUpdate({ ...request, sessionPath: null });
  return composer;
}

export async function openThreadRuntime(request: ComposerStateRequest) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) {
    const { composer } = await emitComposerUpdate({ ...request, sessionPath: null });
    return composer;
  }

  const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
    suspendDisposal: true,
  });
  const composer = await buildComposerState(runtime);
  publishComposerUpdate(composer, {
    projectId: request.projectId ?? runtime.cwd,
    sessionPath: persistedSessionPath,
  });
  scheduleRuntimeDisposal(persistedSessionPath);
  return composer;
}
