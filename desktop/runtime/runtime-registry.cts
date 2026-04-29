import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import {
  abortHeadlessExtensionCommand,
  bindHeadlessAgentSessionExtensions,
  isHeadlessExtensionCommandRunning,
  refreshHeadlessAgentSessionExtensionBindings,
} from "./agent-session-extensions.cts";
import { buildComposerState } from "./composer-state.cts";
import { rememberSessionPath } from "./session-path-index.cts";
import { createRuntimeSettingsRefreshController, isRuntimeBusy } from "./settings-refresh.ts";
import {
  clearRuntimeToolProgress,
  publishComposerUpdate,
  publishThreadUpdate,
  rememberRuntimeToolProgress,
} from "./thread-publisher.cts";
import type { PiRuntime } from "./types.cts";

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;
const LIVE_THREAD_UPDATE_THROTTLE_MS = 50;

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
};

const runtimeRecords = new Map<string, RuntimeRecord>();
const runtimeMutationTails = new Map<string, Promise<void>>();
const liveThreadUpdateTimers = new WeakMap<PiRuntime, ReturnType<typeof setTimeout>>();
const settingsRefreshController = createRuntimeSettingsRefreshController({
  getCachedRuntimeForSessionPath,
  getRuntimeRecords: () =>
    [...runtimeRecords.entries()].map(([runtimeKey, record]) => ({
      runtimeKey,
      runtimePromise: record.runtimePromise,
    })),
  withRuntimeMutationLock,
  afterReload: (runtime) => refreshRuntimeExtensionBindings(runtime),
  isRuntimeBusy: isHowcodeRuntimeBusy,
  buildComposerState,
  publishComposerUpdate,
});

function isHowcodeRuntimeBusy(runtime: PiRuntime) {
  return isRuntimeBusy(runtime) || isRuntimeExtensionCommandRunning(runtime);
}

function clearRuntimeDisposeTimeout(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record?.disposeTimeout) {
    return;
  }

  clearTimeout(record.disposeTimeout);
  record.disposeTimeout = null;
}

function suspendRuntimeDisposal(runtimeKey: string) {
  clearRuntimeDisposeTimeout(runtimeKey);
}

function scheduleRuntimeDisposal(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record) {
    return;
  }

  clearRuntimeDisposeTimeout(runtimeKey);

  record.disposeTimeout = setTimeout(() => {
    void (async () => {
      const currentRecord = runtimeRecords.get(runtimeKey);
      if (!currentRecord || currentRecord !== record) {
        return;
      }

      try {
        const runtime = await record.runtimePromise;
        if (isHowcodeRuntimeBusy(runtime)) {
          scheduleRuntimeDisposal(runtimeKey);
          return;
        }

        runtime.session.dispose();
      } catch {
        // Ignore runtime disposal races after failed creation.
      } finally {
        if (runtimeRecords.get(runtimeKey) === record) {
          runtimeRecords.delete(runtimeKey);
        }
      }
    })();
  }, RUNTIME_IDLE_TIMEOUT_MS);
}

function publishRuntimeComposerState(runtime: PiRuntime) {
  return buildComposerState(runtime)
    .then((composer) => {
      publishComposerUpdate(composer, {
        projectId: runtime.cwd,
        sessionPath: runtime.session.sessionFile,
      });
    })
    .catch(() => {
      // Ignore transient composer snapshot errors; a later runtime event will republish state.
    });
}

function handleExtensionCommandStateChange(runtime: PiRuntime) {
  publishRuntimeComposerState(runtime);
  if (!isRuntimeExtensionCommandRunning(runtime)) {
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
    if (runtimeKey) {
      void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
        // Keep stale settings marked; the next safe point retries silently.
      });
    }
  }
}

function publishLiveThreadUpdate(runtime: PiRuntime) {
  void publishThreadUpdate(runtime, "update");
}

function cancelLiveThreadUpdate(runtime: PiRuntime) {
  const timer = liveThreadUpdateTimers.get(runtime);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  liveThreadUpdateTimers.delete(runtime);
}

function deferLiveThreadUpdate(runtime: PiRuntime, options: { requireStreaming?: boolean } = {}) {
  cancelLiveThreadUpdate(runtime);
  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (options.requireStreaming !== false && !runtime.session.isStreaming) {
      return;
    }

    publishLiveThreadUpdate(runtime);
  }, 0);

  liveThreadUpdateTimers.set(runtime, timer);
}

function scheduleLiveThreadUpdate(runtime: PiRuntime) {
  if (liveThreadUpdateTimers.has(runtime)) {
    return;
  }

  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (!runtime.session.isStreaming) {
      return;
    }

    publishLiveThreadUpdate(runtime);
  }, LIVE_THREAD_UPDATE_THROTTLE_MS);

  liveThreadUpdateTimers.set(runtime, timer);
}

export async function reloadRuntimeSettingsIfSafe(
  sessionPath: string,
  options: { useMutationLock?: boolean } = {},
): Promise<boolean> {
  return settingsRefreshController.reloadIfSafe(sessionPath, options);
}

export async function markRuntimeSettingsStale(sessionPath: string | null | undefined) {
  const runtimeKey = getPersistedSessionPath(sessionPath ?? null);
  if (!runtimeKey) {
    return;
  }

  settingsRefreshController.markStale(runtimeKey);
}

export async function markRuntimeSettingsStaleForProject(projectPath?: string | null) {
  settingsRefreshController.markStaleForProject(projectPath);
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
  const runtime = {
    cwd: options.cwd,
    session,
  } satisfies PiRuntime;

  rememberSessionPath(session.sessionFile, options.cwd);

  session.subscribe((event) => {
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
    if (runtimeKey) {
      suspendRuntimeDisposal(runtimeKey);
    }

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

      if (runtimeKey) {
        scheduleRuntimeDisposal(runtimeKey);
      }

      return;
    }

    if (event.type === "agent_end") {
      cancelLiveThreadUpdate(runtime);
      void publishThreadUpdate(runtime, "end");

      if (runtimeKey && settingsRefreshController.isStale(runtimeKey)) {
        void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
          // Keep the stale mark; the next safe point will retry silently.
        });
      }

      if (runtimeKey) {
        scheduleRuntimeDisposal(runtimeKey);
      }

      return;
    }

    if (event.type === "compaction_start") {
      cancelLiveThreadUpdate(runtime);
      void publishThreadUpdate(runtime, "compaction-start");

      publishRuntimeComposerState(runtime);

      return;
    }

    if (event.type === "compaction_end") {
      setTimeout(() => {
        cancelLiveThreadUpdate(runtime);
        void publishThreadUpdate(runtime, "compaction");

        publishRuntimeComposerState(runtime);
      }, 0);

      if (runtimeKey && settingsRefreshController.isStale(runtimeKey)) {
        void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
          // Keep the stale mark; the next safe point will retry silently.
        });
      }

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
      void publishRuntimeComposerState(runtime).finally(() => {
        if (runtimeKey && !runtime.session.isStreaming) {
          scheduleRuntimeDisposal(runtimeKey);
        }
      });
    }
  });

  await bindHeadlessAgentSessionExtensions(session, {
    onExtensionCommandStateChange: () => {
      handleExtensionCommandStateChange(runtime);
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
      handleExtensionCommandStateChange(runtime);
    },
  });
}

function registerRuntime(runtimeKey: string, runtimePromise: Promise<PiRuntime>) {
  const record: RuntimeRecord = {
    runtimePromise,
    disposeTimeout: null,
  };

  runtimeRecords.set(runtimeKey, record);
  return record;
}

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath) {
    return null;
  }

  const record = runtimeRecords.get(persistedSessionPath);
  if (!record) {
    return null;
  }

  return record.runtimePromise;
}

export async function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: { suspendDisposal?: boolean } = {},
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath) {
    throw new Error("A persisted session path is required to open a live runtime.");
  }

  const existingRuntime = runtimeRecords.get(persistedSessionPath);
  if (existingRuntime) {
    if (options.suspendDisposal) {
      suspendRuntimeDisposal(persistedSessionPath);
    }

    const runtime = await existingRuntime.runtimePromise;
    if (!isHowcodeRuntimeBusy(runtime)) {
      await reloadRuntimeSettingsIfSafe(persistedSessionPath, { useMutationLock: false });
    }
    return runtime;
  }

  const { SessionManager } = await getPiModule();
  const sessionManager = SessionManager.open(persistedSessionPath);
  let record: RuntimeRecord | null = null;
  const runtimePromise = createRuntime({
    cwd: sessionManager.getCwd(),
    sessionManager,
  }).catch((error) => {
    if (record && runtimeRecords.get(persistedSessionPath) === record) {
      runtimeRecords.delete(persistedSessionPath);
    }

    throw error;
  });

  record = registerRuntime(persistedSessionPath, runtimePromise);
  return runtimePromise;
}

export async function createRuntimeForNewSession(cwd: string) {
  const runtime = await createRuntime({ cwd });
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);

  if (runtimeKey) {
    const existingRuntime = runtimeRecords.get(runtimeKey);
    if (existingRuntime) {
      suspendRuntimeDisposal(runtimeKey);
      runtime.session.dispose();
      return await existingRuntime.runtimePromise;
    }

    registerRuntime(runtimeKey, Promise.resolve(runtime));
  }

  return runtime;
}

export function scheduleRuntimeDisposalForRuntime(runtime: PiRuntime) {
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
  if (runtimeKey) {
    scheduleRuntimeDisposal(runtimeKey);
  }
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
    if (releaseCurrentTail) {
      releaseCurrentTail();
    }
    if (runtimeMutationTails.get(runtimeKey) === nextTail) {
      runtimeMutationTails.delete(runtimeKey);
    }
  }
}
