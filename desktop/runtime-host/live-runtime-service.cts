import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  ComposerAttachment,
  ComposerSlashCommand,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopEvent,
} from "../../shared/desktop-contracts.ts";
import {
  appSettingsSlashCommand,
  compactSlashCommand,
  parseCompactSlashCommand,
} from "../../shared/composer-slash-commands.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { createLocalThreadDraft, getPersistedSessionPath } from "../../shared/session-paths.ts";
import { type SessionPathEntry, buildThreadHistorySlice } from "../../shared/thread-history.ts";
import {
  buildThreadData,
  setThreadCompactingState,
  setThreadStreamingState,
} from "../../shared/thread-data.ts";
import { getPiModule } from "../pi-module.cts";
import {
  bindHeadlessAgentSessionExtensions,
  discoverHeadlessAgentSessionResources,
} from "../runtime/agent-session-extensions.cts";
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
import type { PiRuntime, RuntimeThreadReason } from "../runtime/types.cts";

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
};

type RuntimeToolProgress = {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  partialResult?: { content?: unknown };
  isError?: boolean;
  terminal?: boolean;
};

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;
const LIVE_THREAD_UPDATE_THROTTLE_MS = 50;

const runtimeRecords = new Map<string, RuntimeRecord>();
const runtimeMutationTails = new Map<string, Promise<void>>();
const liveThreadUpdateTimers = new WeakMap<PiRuntime, ReturnType<typeof setTimeout>>();
const liveToolProgressByRuntime = new WeakMap<PiRuntime, Map<string, RuntimeToolProgress>>();

const builtinCommandNames = new Set([compactSlashCommand.name]);

function mapSessionCommands(session: PiRuntime["session"]): ComposerSlashCommand[] {
  const commands: ComposerSlashCommand[] = [appSettingsSlashCommand, compactSlashCommand];
  const extensionCommandNames = new Set<string>();

  for (const command of session.extensionRunner.getRegisteredCommands()) {
    if (builtinCommandNames.has(command.invocationName)) {
      continue;
    }

    extensionCommandNames.add(command.invocationName);
    commands.push({
      name: command.invocationName,
      description: command.description,
      source: "extension",
      sourceInfo: command.sourceInfo,
    });
  }

  for (const template of session.promptTemplates) {
    if (builtinCommandNames.has(template.name) || extensionCommandNames.has(template.name)) {
      continue;
    }

    commands.push({
      name: template.name,
      description: template.description,
      source: "prompt",
      sourceInfo: template.sourceInfo,
    });
  }

  if (session.settingsManager.getEnableSkillCommands()) {
    for (const skill of session.resourceLoader.getSkills().skills) {
      const skillCommandName = `skill:${skill.name}`;
      if (
        builtinCommandNames.has(skillCommandName) ||
        extensionCommandNames.has(skillCommandName)
      ) {
        continue;
      }

      commands.push({
        name: skillCommandName,
        description: skill.description,
        source: "skill",
        sourceInfo: skill.sourceInfo,
      });
    }
  }

  return commands;
}

let eventSink: ((event: DesktopEvent) => void) | null = null;

export function setRuntimeHostEventSink(sink: (event: DesktopEvent) => void) {
  eventSink = sink;
}

function emitDesktopEvent(event: DesktopEvent) {
  eventSink?.(event);
}

function getLiveToolProgress(runtime: PiRuntime) {
  let progress = liveToolProgressByRuntime.get(runtime);
  if (!progress) {
    progress = new Map();
    liveToolProgressByRuntime.set(runtime, progress);
  }
  return progress;
}

function hasDisplayableToolContent(content: unknown): content is string | unknown[] {
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    if (typeof part === "string") return part.trim().length > 0;
    if (!part || typeof part !== "object") return false;
    const record = part as Record<string, unknown>;
    if (record.type === "image") return true;
    return typeof record.text === "string" && record.text.trim().length > 0;
  });
}

function getLiveToolProgressMessages(runtime: PiRuntime) {
  const progress = liveToolProgressByRuntime.get(runtime);
  if (!progress || progress.size === 0) return [] as AgentMessage[];
  return [...progress.values()].map((entry) => {
    const content = entry.partialResult?.content;
    const displayContent = hasDisplayableToolContent(content)
      ? content
      : [
          {
            type: "text",
            text: entry.terminal
              ? entry.isError
                ? `${entry.toolName} failed.`
                : `${entry.toolName} finished.`
              : `Running ${entry.toolName}...`,
          },
        ];
    return {
      role: "toolResult",
      toolName: entry.toolName,
      isError: Boolean(entry.isError),
      content: displayContent,
      timestamp: `tool-progress:${entry.toolCallId}`,
    } as unknown as AgentMessage;
  });
}

function rememberRuntimeToolProgress(runtime: PiRuntime, entry: RuntimeToolProgress) {
  getLiveToolProgress(runtime).set(entry.toolCallId, entry);
}

function clearRuntimeToolProgress(
  runtime: PiRuntime,
  options: { toolCallId?: string; toolName?: string } = {},
) {
  const progress = liveToolProgressByRuntime.get(runtime);
  if (!progress) return;
  if (options.toolCallId) progress.delete(options.toolCallId);
  else if (!options.toolName) progress.clear();
  else {
    for (const [toolCallId, entry] of progress) {
      if (entry.toolName === options.toolName) {
        progress.delete(toolCallId);
        break;
      }
    }
  }
  if (progress.size === 0) liveToolProgressByRuntime.delete(runtime);
}

function normalizeThreadDataForReason(
  thread: ReturnType<typeof buildThreadData>,
  reason: RuntimeThreadReason,
) {
  if (reason === "compaction-start") return setThreadCompactingState(thread, true);
  if (reason !== "end" && reason !== "compaction") return thread;
  return setThreadCompactingState(setThreadStreamingState(thread, false), false);
}

function buildLiveThreadData(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) return null;
  const streamingMessage = runtime.session.state.streamingMessage;
  const historySlice = buildThreadHistorySlice(
    [...(runtime.session.sessionManager.getBranch() as SessionPathEntry[])],
    0,
  );
  const sourceMessages = [
    ...historySlice.sourceMessages,
    ...(streamingMessage ? [streamingMessage] : []),
    ...getLiveToolProgressMessages(runtime),
  ] as AgentMessage[];
  return buildThreadData({
    sessionPath,
    sourceMessages,
    previousMessageCount: historySlice.previousMessageCount,
    isStreaming: runtime.session.isStreaming,
    isCompacting: runtime.session.isCompacting,
  });
}

async function publishThreadUpdate(runtime: PiRuntime, reason: RuntimeThreadReason) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) return;
  const liveThread = buildLiveThreadData(runtime);
  if (!liveThread) return;
  emitDesktopEvent({
    type: "thread-update",
    reason,
    projectId: runtime.cwd,
    threadId: runtime.session.sessionId,
    sessionPath,
    thread: normalizeThreadDataForReason(liveThread, reason),
    composer: await buildComposerState(runtime, { includeContextUsage: reason !== "update" }),
  });
}

function publishComposerUpdate(
  composer: Awaited<ReturnType<typeof buildComposerState>>,
  context: { projectId?: string | null; sessionPath?: string | null } = {},
) {
  emitDesktopEvent({
    type: "composer-update",
    composer,
    projectId: context.projectId ?? null,
    sessionPath: context.sessionPath ?? null,
  });
}

function clearRuntimeDisposeTimeout(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record?.disposeTimeout) return;
  clearTimeout(record.disposeTimeout);
  record.disposeTimeout = null;
}

function suspendRuntimeDisposal(runtimeKey: string) {
  clearRuntimeDisposeTimeout(runtimeKey);
}

function scheduleRuntimeDisposal(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record) return;
  clearRuntimeDisposeTimeout(runtimeKey);
  record.disposeTimeout = setTimeout(() => {
    void (async () => {
      const currentRecord = runtimeRecords.get(runtimeKey);
      if (!currentRecord || currentRecord !== record) return;
      try {
        const runtime = await record.runtimePromise;
        if (runtime.session.isStreaming || runtime.session.isCompacting) {
          scheduleRuntimeDisposal(runtimeKey);
          return;
        }
        runtime.session.dispose();
      } catch {
        // Ignore runtime disposal races.
      } finally {
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
      }
    })();
  }, RUNTIME_IDLE_TIMEOUT_MS);
}

function cancelLiveThreadUpdate(runtime: PiRuntime) {
  const timer = liveThreadUpdateTimers.get(runtime);
  if (!timer) return;
  clearTimeout(timer);
  liveThreadUpdateTimers.delete(runtime);
}

function deferLiveThreadUpdate(runtime: PiRuntime, options: { requireStreaming?: boolean } = {}) {
  cancelLiveThreadUpdate(runtime);
  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (options.requireStreaming !== false && !runtime.session.isStreaming) return;
    void publishThreadUpdate(runtime, "update");
  }, 0);
  liveThreadUpdateTimers.set(runtime, timer);
}

function scheduleLiveThreadUpdate(runtime: PiRuntime) {
  if (liveThreadUpdateTimers.has(runtime)) return;
  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (!runtime.session.isStreaming) return;
    void publishThreadUpdate(runtime, "update");
  }, LIVE_THREAD_UPDATE_THROTTLE_MS);
  liveThreadUpdateTimers.set(runtime, timer);
}

async function createRuntime(options: {
  cwd: string;
  sessionManager?: PiRuntime["session"]["sessionManager"];
}): Promise<PiRuntime> {
  const {
    AuthStorage,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    createAgentSession,
    getAgentDir,
  } = await getPiModule();
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = SettingsManager.create(options.cwd, agentDir);
  const sessionDir = settingsManager.getSessionDir() ?? undefined;
  const { session } = await createAgentSession({
    cwd: options.cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager: options.sessionManager ?? SessionManager.create(options.cwd, sessionDir),
  });
  const runtime = { cwd: options.cwd, session } satisfies PiRuntime;

  session.subscribe((event) => {
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
    if (runtimeKey) suspendRuntimeDisposal(runtimeKey);

    if (event.type === "message_start") {
      scheduleLiveThreadUpdate(runtime);
      return;
    }
    if (event.type === "message_end") {
      if (event.message.role === "user") {
        cancelLiveThreadUpdate(runtime);
        void publishThreadUpdate(runtime, "start");
      } else {
        if (event.message.role === "toolResult") {
          const toolCallId = "toolCallId" in event.message ? event.message.toolCallId : undefined;
          clearRuntimeToolProgress(runtime, {
            toolCallId: typeof toolCallId === "string" ? toolCallId : undefined,
            toolName: event.message.toolName,
          });
        }
        deferLiveThreadUpdate(runtime, { requireStreaming: event.message.role === "toolResult" });
      }
      if (runtimeKey) scheduleRuntimeDisposal(runtimeKey);
      return;
    }
    if (event.type === "agent_end") {
      cancelLiveThreadUpdate(runtime);
      void publishThreadUpdate(runtime, "end");
      if (runtimeKey) scheduleRuntimeDisposal(runtimeKey);
      return;
    }
    if (event.type === "compaction_start") {
      cancelLiveThreadUpdate(runtime);
      void publishThreadUpdate(runtime, "compaction-start");
      void buildComposerState(runtime)
        .then((composer) =>
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          }),
        )
        .catch(() => {});
      return;
    }
    if (event.type === "compaction_end") {
      setTimeout(() => {
        cancelLiveThreadUpdate(runtime);
        void publishThreadUpdate(runtime, "compaction");
        void buildComposerState(runtime)
          .then((composer) =>
            publishComposerUpdate(composer, {
              projectId: runtime.cwd,
              sessionPath: runtime.session.sessionFile,
            }),
          )
          .catch(() => {});
      }, 0);
      return;
    }
    if (event.type === "message_update") {
      scheduleLiveThreadUpdate(runtime);
      return;
    }
    if (
      event.type === "tool_execution_start" ||
      event.type === "tool_execution_update" ||
      event.type === "tool_execution_end"
    ) {
      rememberRuntimeToolProgress(runtime, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: "args" in event ? event.args : undefined,
        partialResult:
          event.type === "tool_execution_update"
            ? event.partialResult
            : event.type === "tool_execution_end"
              ? event.result
              : undefined,
        isError: event.type === "tool_execution_end" ? event.isError : false,
        terminal: event.type === "tool_execution_end",
      });
      scheduleLiveThreadUpdate(runtime);
      return;
    }
    if (event.type === "queue_update") {
      void buildComposerState(runtime)
        .then((composer) =>
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          }),
        )
        .finally(() => {
          if (runtimeKey && !runtime.session.isStreaming) scheduleRuntimeDisposal(runtimeKey);
        });
    }
  });

  await bindHeadlessAgentSessionExtensions(session);
  return runtime;
}

function registerRuntime(runtimeKey: string, runtimePromise: Promise<PiRuntime>) {
  const record: RuntimeRecord = { runtimePromise, disposeTimeout: null };
  runtimeRecords.set(runtimeKey, record);
  return record;
}

function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  return persistedSessionPath
    ? (runtimeRecords.get(persistedSessionPath)?.runtimePromise ?? null)
    : null;
}

async function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: { suspendDisposal?: boolean } = {},
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath)
    throw new Error("A persisted session path is required to open a live runtime.");
  const existingRuntime = runtimeRecords.get(persistedSessionPath);
  if (existingRuntime) {
    if (options.suspendDisposal) suspendRuntimeDisposal(persistedSessionPath);
    return await existingRuntime.runtimePromise;
  }
  const { SessionManager } = await getPiModule();
  const sessionManager = SessionManager.open(persistedSessionPath);
  let record: RuntimeRecord | null = null;
  const runtimePromise = createRuntime({ cwd: sessionManager.getCwd(), sessionManager }).catch(
    (error) => {
      if (record && runtimeRecords.get(persistedSessionPath) === record)
        runtimeRecords.delete(persistedSessionPath);
      throw error;
    },
  );
  record = registerRuntime(persistedSessionPath, runtimePromise);
  return runtimePromise;
}

async function createRuntimeForNewSession(cwd: string) {
  const runtime = await createRuntime({ cwd });
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
  if (runtimeKey) registerRuntime(runtimeKey, Promise.resolve(runtime));
  return runtime;
}

async function withRuntimeMutationLock<T>(runtimeKey: string, task: () => Promise<T>) {
  const previousTail = runtimeMutationTails.get(runtimeKey) ?? Promise.resolve();
  let releaseCurrentTail: (() => void) | undefined;
  const currentTail = new Promise<void>((resolve) => {
    releaseCurrentTail = resolve;
  });
  const nextTail = previousTail.then(() => currentTail);
  runtimeMutationTails.set(runtimeKey, nextTail);
  await previousTail;
  try {
    return await task();
  } finally {
    releaseCurrentTail?.();
    if (runtimeMutationTails.get(runtimeKey) === nextTail) runtimeMutationTails.delete(runtimeKey);
  }
}

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
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null;
  if (runtimePromise) {
    return mapSessionCommands((await runtimePromise).session);
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
  const runtimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null;
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
    const { AuthStorage, ModelRegistry, SettingsManager, getAgentDir } = await getPiModule();
    const cwd = request.projectId ?? getDesktopWorkingDirectory();
    const agentDir = getAgentDir();
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
    const model = modelRegistry.find(provider, modelId);
    if (!model) throw new Error(`Unknown Pi model: ${provider}/${modelId}`);
    const currentComposer = await buildComposerStateSnapshot({ projectId: cwd, sessionPath: null });
    SettingsManager.create(cwd, agentDir).setDefaultModelAndProvider(provider, modelId);
    SettingsManager.create(cwd, agentDir).setDefaultThinkingLevel(
      clampThinkingLevel(
        currentComposer.currentThinkingLevel,
        getAvailableThinkingLevelsForModel(model),
      ),
    );
    await emitComposerUpdate({ ...request, sessionPath: null });
    return { ok: true as const };
  }
  await withRuntimeMutationLock(persistedSessionPath, async () => {
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
      const streamingBehavior = request.streamingBehavior ?? "followUp";
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
    if (cachedRuntime.session.isStreaming) return await runSend(cachedRuntime);
  }
  return await withRuntimeMutationLock(
    persistedSessionPath,
    async () =>
      await runSend(
        await getOrCreateRuntimeForSessionPath(persistedSessionPath, { suspendDisposal: true }),
      ),
  );
}

export async function stopComposerRun(request: ComposerStateRequest) {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  if (!persistedSessionPath) return { ok: true as const };
  await withRuntimeMutationLock(persistedSessionPath, async () => {
    const runtime = await getOrCreateRuntimeForSessionPath(persistedSessionPath, {
      suspendDisposal: true,
    });
    await runtime.session.abort();
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
      await replayComposerQueue(runtime.session, dequeueResult.nextQueue);
      await emitComposerUpdate({ ...request, sessionPath: persistedSessionPath });
      return dequeueResult.dequeuedText;
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
  const { composer } = await emitComposerUpdate({
    ...request,
    sessionPath: getPersistedSessionPath(request.sessionPath),
  });
  return composer;
}
