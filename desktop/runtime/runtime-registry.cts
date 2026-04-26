import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import { buildComposerState } from "./composer-state.cts";
import { rememberSessionPath } from "./session-path-index.cts";
import { createRuntimeSettingsRefreshController, isRuntimeBusy } from "./settings-refresh.ts";
import { publishComposerUpdate, publishThreadUpdate } from "./thread-publisher.cts";
import type { PiRuntime } from "./types.cts";

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
};

const runtimeRecords = new Map<string, RuntimeRecord>();
const runtimeMutationTails = new Map<string, Promise<void>>();
const settingsRefreshController = createRuntimeSettingsRefreshController({
  getCachedRuntimeForSessionPath,
  getRuntimeRecords: () =>
    [...runtimeRecords.entries()].map(([runtimeKey, record]) => ({
      runtimeKey,
      runtimePromise: record.runtimePromise,
    })),
  withRuntimeMutationLock,
  buildComposerState,
  publishComposerUpdate,
});

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
        if (isRuntimeBusy(runtime)) {
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

    if (event.type === "message_end") {
      if (event.message.role === "user") {
        void publishThreadUpdate(runtime, "start");
      }

      if (runtimeKey) {
        scheduleRuntimeDisposal(runtimeKey);
      }

      return;
    }

    if (event.type === "agent_end") {
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

    if (event.type === "compaction_end") {
      if (event.reason === "manual" && event.result) {
        void publishThreadUpdate(runtime, "compaction");
      }

      if (runtimeKey && settingsRefreshController.isStale(runtimeKey)) {
        void reloadRuntimeSettingsIfSafe(runtimeKey).catch(() => {
          // Keep the stale mark; the next safe point will retry silently.
        });
      }

      return;
    }

    if (event.type === "message_update" && event.message.role === "assistant") {
      void publishThreadUpdate(runtime, "update");
      return;
    }

    if (event.type === "queue_update") {
      void buildComposerState(runtime)
        .then((composer) => {
          publishComposerUpdate(composer, {
            projectId: runtime.cwd,
            sessionPath: runtime.session.sessionFile,
          });
        })
        .catch(() => {
          // Ignore transient composer snapshot errors; a later runtime event will republish state.
        })
        .finally(() => {
          if (runtimeKey && !runtime.session.isStreaming) {
            scheduleRuntimeDisposal(runtimeKey);
          }
        });
    }
  });

  return runtime;
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
    if (!isRuntimeBusy(runtime)) {
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
