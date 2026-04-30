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
import {
  cancelLiveThreadUpdate,
  deferLiveThreadUpdate,
  deleteRuntimeRecordIfCurrent,
  getRuntimeRecord,
  getRuntimeRecordSnapshots,
  registerRuntime,
  scheduleLiveThreadUpdate,
  scheduleRuntimeDisposal,
  suspendRuntimeDisposal,
  withRuntimeMutationLock,
} from "./registry/runtime-registry-state.cts";
export { withRuntimeMutationLock } from "./registry/runtime-registry-state.cts";
import type { RuntimeRecord } from "./registry/runtime-registry-state.cts";
import type { PiRuntime } from "./types.cts";

const settingsRefreshController = createRuntimeSettingsRefreshController({
  getCachedRuntimeForSessionPath,
  getRuntimeRecords: getRuntimeRecordSnapshots,
  withRuntimeMutationLock,
  afterReload: (runtime) => refreshRuntimeExtensionBindings(runtime),
  isRuntimeBusy: isHowcodeRuntimeBusy,
  buildComposerState,
  publishComposerUpdate,
});

function isHowcodeRuntimeBusy(runtime: PiRuntime) {
  return isRuntimeBusy(runtime) || isRuntimeExtensionCommandRunning(runtime);
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
  sessionDir?: string | null;
  settingsCwd?: string | null;
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
  const settingsManager = SettingsManager.create(options.settingsCwd ?? options.cwd, agentDir);
  if (options.settingsCwd) {
    const projectSettings = settingsManager.getProjectSettings();
    settingsManager.applyOverrides({
      packages: projectSettings.packages ?? [],
      extensions: projectSettings.extensions ?? [],
      skills: projectSettings.skills ?? [],
    });
  }
  const sessionDir = options.sessionDir ?? settingsManager.getSessionDir() ?? undefined;
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
      scheduleLiveThreadUpdate(runtime, publishLiveThreadUpdate);
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
        deferLiveThreadUpdate(runtime, publishLiveThreadUpdate, {
          requireStreaming: event.message.role === "toolResult",
        });
      }

      if (runtimeKey) {
        scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy);
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
        scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy);
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
      scheduleLiveThreadUpdate(runtime, publishLiveThreadUpdate);
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
      scheduleLiveThreadUpdate(runtime, publishLiveThreadUpdate);
      return;
    }

    if (event.type === "queue_update") {
      void publishRuntimeComposerState(runtime).finally(() => {
        if (runtimeKey && !runtime.session.isStreaming) {
          scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy);
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

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath) {
    return null;
  }

  const record = getRuntimeRecord(persistedSessionPath);
  if (!record) {
    return null;
  }

  return record.runtimePromise;
}

export async function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: { suspendDisposal?: boolean; settingsCwd?: string | null } = {},
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath) {
    throw new Error("A persisted session path is required to open a live runtime.");
  }

  const existingRuntime = getRuntimeRecord(persistedSessionPath);
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
    settingsCwd: options.settingsCwd ?? null,
    sessionManager,
  }).catch((error) => {
    if (record) {
      deleteRuntimeRecordIfCurrent(persistedSessionPath, record);
    }

    throw error;
  });

  record = registerRuntime(persistedSessionPath, runtimePromise);
  return runtimePromise;
}

export async function createRuntimeForNewSession(cwd: string, sessionDir?: string | null) {
  const runtime = await createRuntime({
    cwd,
    sessionDir,
    settingsCwd: sessionDir ?? null,
  });
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);

  if (runtimeKey) {
    const existingRuntime = getRuntimeRecord(runtimeKey);
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
    scheduleRuntimeDisposal(runtimeKey, isHowcodeRuntimeBusy);
  }
}
