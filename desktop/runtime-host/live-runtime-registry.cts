import path from "node:path";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import {
  abortHeadlessExtensionCommand,
  bindHeadlessAgentSessionExtensions,
  isHeadlessExtensionCommandRunning,
  refreshHeadlessAgentSessionExtensionBindings,
} from "../runtime/agent-session-extensions.cts";
import { buildComposerState } from "../runtime/composer-state.cts";
import { createArtifactTools } from "../runtime/artifact-tools.cts";
import { invokeMainRequest } from "./main-request-client.cts";
import {
  createIsolatedRuntimeResourceLoader,
  createRuntimeSettingsManager,
} from "../runtime/isolated-settings-manager.cts";
import type { PiRuntime } from "../runtime/types.cts";
import {
  cancelLiveThreadUpdate,
  deferLiveThreadUpdate,
  publishComposerUpdate,
  publishThreadUpdate,
  scheduleLiveThreadUpdate,
} from "./live-thread-publisher.cts";
import { emitDesktopEvent } from "./host-events.cts";
import { clearRuntimeToolProgress, rememberRuntimeToolProgress } from "./live-tool-progress.cts";

function getRuntimeDiagnosticExtensionLabel(extensionPath: string) {
  if (extensionPath.startsWith("command:")) return `/${extensionPath.slice("command:".length)}`;
  if (extensionPath.startsWith("<")) return extensionPath.replace(/[<>]/g, "");
  return path.basename(extensionPath).replace(/\.(ts|js)$/, "");
}

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
  settingsCwd: string | null;
};

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;

const runtimeRecords = new Map<string, RuntimeRecord>();
const runtimeMutationTails = new Map<string, Promise<void>>();
const staleRuntimeGenerations = new Map<string, number>();

function clearRuntimeDisposeTimeout(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record?.disposeTimeout) return;
  clearTimeout(record.disposeTimeout);
  record.disposeTimeout = null;
}

function suspendRuntimeDisposal(runtimeKey: string) {
  clearRuntimeDisposeTimeout(runtimeKey);
}

export function scheduleRuntimeDisposal(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record) return;
  clearRuntimeDisposeTimeout(runtimeKey);
  record.disposeTimeout = setTimeout(() => {
    void (async () => {
      const currentRecord = runtimeRecords.get(runtimeKey);
      if (!currentRecord || currentRecord !== record) return;
      try {
        const runtime = await record.runtimePromise;
        if (
          runtime.session.isStreaming ||
          runtime.session.isCompacting ||
          isRuntimeExtensionCommandRunning(runtime)
        ) {
          scheduleRuntimeDisposal(runtimeKey);
          return;
        }
        runtime.session.dispose();
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
        staleRuntimeGenerations.delete(runtimeKey);
      } catch {
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
        staleRuntimeGenerations.delete(runtimeKey);
      }
    })();
  }, RUNTIME_IDLE_TIMEOUT_MS);
}

async function createRuntime(options: {
  cwd: string;
  sessionDir?: string | null;
  settingsCwd?: string | null;
  chatGroupId?: string | null;
  sessionManager?: PiRuntime["session"]["sessionManager"];
}): Promise<PiRuntime> {
  const {
    AuthStorage,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    DefaultResourceLoader,
    createAgentSession,
    getAgentDir,
  } = await getPiModule();
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = createRuntimeSettingsManager({
    SettingsManager,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
  });
  const sessionDir = options.sessionDir ?? settingsManager.getSessionDir() ?? undefined;
  const resourceLoader = await createIsolatedRuntimeResourceLoader({
    DefaultResourceLoader,
    cwd: options.cwd,
    agentDir,
    settingsCwd: options.settingsCwd,
    settingsManager,
  });
  const { session } = await createAgentSession({
    cwd: options.cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    resourceLoader,
    sessionManager: options.sessionManager ?? SessionManager.create(options.cwd, sessionDir),
    ...(options.settingsCwd
      ? {
          noTools: "builtin" as const,
          customTools: createArtifactTools({
            createArtifact: (input) => invokeMainRequest("createArtifact", input),
            editArtifact: (input) => invokeMainRequest("editArtifact", input),
            getArtifact: ({ conversationId, slug }) =>
              invokeMainRequest("getArtifact", { artifactSlug: slug, conversationId }),
            listArtifacts: (conversationId) =>
              invokeMainRequest("listArtifacts", { conversationId }),
          }),
        }
      : {}),
  });
  const runtime = {
    cwd: options.cwd,
    session,
    chatGroupId: options.chatGroupId ?? null,
  } satisfies PiRuntime;

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
      if (runtimeKey) {
        void reloadRuntimeSettingsIfSafe(runtimeKey).finally(() =>
          scheduleRuntimeDisposal(runtimeKey),
        );
      }
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
          .catch((error) => {
            console.warn("Failed to publish composer state after compaction end", error);
          })
          .finally(() => {
            if (runtimeKey) {
              void reloadRuntimeSettingsIfSafe(runtimeKey).finally(() =>
                scheduleRuntimeDisposal(runtimeKey),
              );
            }
          });
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
        .catch((error) => {
          console.warn("Failed to publish composer state after queue update", error);
        })
        .finally(() => {
          if (runtimeKey && !runtime.session.isStreaming) scheduleRuntimeDisposal(runtimeKey);
        });
    }
  });

  await bindHeadlessAgentSessionExtensions(session, {
    onExtensionCommandStateChange: () => {
      void buildComposerState(runtime)
        .then((composer) =>
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          }),
        )
        .catch((error) => console.warn("Failed to publish extension command state", error));
      if (!isRuntimeExtensionCommandRunning(runtime)) {
        const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
        if (runtimeKey) {
          void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
            // Keep stale settings marked; the next safe point retries silently.
          });
        }
      }
    },
    onExtensionError: (error) => {
      const extensionLabel = getRuntimeDiagnosticExtensionLabel(error.extensionPath);
      emitDesktopEvent({
        type: "runtime-diagnostic",
        severity: "error",
        message: `${extensionLabel} extension error: ${error.error}`,
        details: { ...error, extensionLabel },
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile ?? null,
      });
    },
  });
  return runtime;
}

export function abortRuntimeExtensionCommand(runtime: PiRuntime) {
  return abortHeadlessExtensionCommand(runtime.session);
}

export function isRuntimeExtensionCommandRunning(runtime: PiRuntime) {
  return isHeadlessExtensionCommandRunning(runtime.session);
}

export async function refreshRuntimeExtensionBindings(runtime: PiRuntime) {
  await refreshHeadlessAgentSessionExtensionBindings(runtime.session, {
    onExtensionCommandStateChange: () => {
      void buildComposerState(runtime)
        .then((composer) =>
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          }),
        )
        .catch((error) => console.warn("Failed to publish extension command state", error));
      if (!isRuntimeExtensionCommandRunning(runtime)) {
        const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
        if (runtimeKey) {
          void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
            // Keep stale settings marked; the next safe point retries silently.
          });
        }
      }
    },
  });
}

function normalizeSettingsCwd(settingsCwd?: string | null) {
  return settingsCwd ? path.resolve(settingsCwd) : null;
}

function registerRuntime(
  runtimeKey: string,
  runtimePromise: Promise<PiRuntime>,
  settingsCwd?: string | null,
) {
  staleRuntimeGenerations.delete(runtimeKey);
  const record: RuntimeRecord = {
    runtimePromise,
    disposeTimeout: null,
    settingsCwd: normalizeSettingsCwd(settingsCwd),
  };
  runtimeRecords.set(runtimeKey, record);
  return record;
}

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  return persistedSessionPath
    ? (runtimeRecords.get(persistedSessionPath)?.runtimePromise ?? null)
    : null;
}

export async function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: {
    suspendDisposal?: boolean;
    settingsCwd?: string | null;
    chatGroupId?: string | null;
  } = {},
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath)
    throw new Error("A persisted session path is required to open a live runtime.");
  const settingsCwd = normalizeSettingsCwd(options.settingsCwd);
  const existingRuntime = runtimeRecords.get(persistedSessionPath);
  if (existingRuntime) {
    if (existingRuntime.settingsCwd !== settingsCwd) {
      const runtime = await existingRuntime.runtimePromise;
      runtime.session.dispose();
      runtimeRecords.delete(persistedSessionPath);
    } else {
      if (options.suspendDisposal) suspendRuntimeDisposal(persistedSessionPath);
      return await existingRuntime.runtimePromise;
    }
  }
  const { SessionManager } = await getPiModule();
  const sessionManager = SessionManager.open(persistedSessionPath);
  let record: RuntimeRecord | null = null;
  const runtimePromise = createRuntime({
    cwd: sessionManager.getCwd(),
    settingsCwd,
    chatGroupId: options.chatGroupId ?? null,
    sessionManager,
  }).catch((error) => {
    if (record && runtimeRecords.get(persistedSessionPath) === record)
      runtimeRecords.delete(persistedSessionPath);
    staleRuntimeGenerations.delete(persistedSessionPath);
    throw error;
  });
  record = registerRuntime(persistedSessionPath, runtimePromise, settingsCwd);
  return runtimePromise;
}

export async function createRuntimeForNewSession(
  cwd: string,
  sessionDir?: string | null,
  options: { chatGroupId?: string | null } = {},
) {
  const runtime = await createRuntime({
    cwd,
    sessionDir,
    settingsCwd: sessionDir ?? null,
    chatGroupId: options.chatGroupId ?? null,
  });
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
  if (runtimeKey) registerRuntime(runtimeKey, Promise.resolve(runtime), sessionDir ?? null);
  return runtime;
}

export async function withRuntimeMutationLock<T>(runtimeKey: string, task: () => Promise<T>) {
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

async function reloadRuntimeSettings(
  runtimeKey: string,
  runtime: PiRuntime,
  staleGeneration: number,
) {
  if (
    runtime.session.isStreaming ||
    runtime.session.isCompacting ||
    isRuntimeExtensionCommandRunning(runtime)
  )
    return false;
  await runtime.session.reload();
  await refreshRuntimeExtensionBindings(runtime);
  const composer = await buildComposerState(runtime);
  publishComposerUpdate(composer, {
    projectId: runtime.cwd,
    sessionPath: runtime.session.sessionFile ?? null,
  });
  if (staleRuntimeGenerations.get(runtimeKey) === staleGeneration) {
    staleRuntimeGenerations.delete(runtimeKey);
  }
  return true;
}

export async function reloadRuntimeSettingsIfSafe(
  sessionPath: string,
  options: { useMutationLock?: boolean } = {},
): Promise<boolean> {
  const runtimeKey = getPersistedSessionPath(sessionPath);
  if (!runtimeKey) return false;
  const staleGeneration = staleRuntimeGenerations.get(runtimeKey);
  if (staleGeneration === undefined) return false;

  if (options.useMutationLock ?? true) {
    return await withRuntimeMutationLock(runtimeKey, () =>
      reloadRuntimeSettingsIfSafe(runtimeKey, { useMutationLock: false }),
    );
  }

  const runtimePromise = getCachedRuntimeForSessionPath(runtimeKey);
  if (!runtimePromise) {
    if (staleRuntimeGenerations.get(runtimeKey) === staleGeneration) {
      staleRuntimeGenerations.delete(runtimeKey);
    }
    return false;
  }

  try {
    return await reloadRuntimeSettings(runtimeKey, await runtimePromise, staleGeneration);
  } catch {
    // Keep stale; next safe point retries.
    return false;
  }
}

async function markRuntimeRecordStale(runtimeKey: string, record: RuntimeRecord) {
  staleRuntimeGenerations.set(runtimeKey, (staleRuntimeGenerations.get(runtimeKey) ?? 0) + 1);
  clearRuntimeDisposeTimeout(runtimeKey);
  try {
    await record.runtimePromise;
  } catch {
    if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
    staleRuntimeGenerations.delete(runtimeKey);
    return;
  }
  await reloadRuntimeSettingsIfSafe(runtimeKey);
}

export async function invalidateRuntimeSettings(
  request: {
    sessionPath?: string | null;
    projectPath?: string | null;
  } = {},
) {
  const sessionPath = getPersistedSessionPath(request.sessionPath);
  if (sessionPath) {
    const record = runtimeRecords.get(sessionPath);
    if (record) await markRuntimeRecordStale(sessionPath, record);
    return { ok: true as const };
  }

  const projectPath = request.projectPath?.trim() || null;
  const resolvedProjectPath = projectPath ? path.resolve(projectPath) : null;
  const entries = [...runtimeRecords.entries()];
  await Promise.all(
    entries.map(async ([runtimeKey, record]) => {
      let runtime: PiRuntime;
      try {
        runtime = await record.runtimePromise;
      } catch {
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
        staleRuntimeGenerations.delete(runtimeKey);
        return;
      }
      if (resolvedProjectPath && path.resolve(runtime.cwd) !== resolvedProjectPath) return;
      await markRuntimeRecordStale(runtimeKey, record);
    }),
  );
  return { ok: true as const };
}

export async function disposeAllRuntimeHosts() {
  const entries = [...runtimeRecords.entries()];
  runtimeRecords.clear();
  staleRuntimeGenerations.clear();
  await Promise.all(
    entries.map(async ([runtimeKey, record]) => {
      clearRuntimeDisposeTimeout(runtimeKey);
      try {
        (await record.runtimePromise).session.dispose();
      } catch {
        // Ignore shutdown races.
      }
    }),
  );
}
