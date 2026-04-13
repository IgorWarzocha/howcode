import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { captureCompletedTurnDiff } from "../diff/query.cts";
import { getPiModule } from "../pi-module.cts";
import { rememberSessionPath } from "./session-path-index.cts";
import { publishThreadUpdate } from "./thread-publisher.cts";
import type { PiRuntime } from "./types.cts";

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
};

const runtimeRecords = new Map<string, RuntimeRecord>();

function clearRuntimeDisposeTimeout(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record?.disposeTimeout) {
    return;
  }

  clearTimeout(record.disposeTimeout);
  record.disposeTimeout = null;
}

function touchRuntime(runtimeKey: string) {
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
        if (runtime.session.isStreaming) {
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
    pendingTurnCount: null,
  } satisfies PiRuntime;

  rememberSessionPath(session.sessionFile, options.cwd);

  session.subscribe((event) => {
    const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
    if (runtimeKey) {
      touchRuntime(runtimeKey);
    }

    if (event.type === "message_end") {
      if (event.message.role === "user") {
        void publishThreadUpdate(runtime, "start");
      }
      if (event.message.role === "assistant") {
        void (async () => {
          try {
            await captureCompletedTurnDiff(runtime);
          } catch (error) {
            console.warn("Failed to capture turn diff.", error);
          }

          await publishThreadUpdate(runtime, "end");
        })();
      }

      if (runtimeKey) {
        scheduleRuntimeDisposal(runtimeKey);
      }

      return;
    }

    if (event.type === "message_update" && event.message.role === "assistant") {
      void publishThreadUpdate(runtime, "update");
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
  touchRuntime(runtimeKey);
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

  touchRuntime(persistedSessionPath);
  return record.runtimePromise;
}

export async function getOrCreateRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath) {
    throw new Error("A persisted session path is required to open a live runtime.");
  }

  const existingRuntime = runtimeRecords.get(persistedSessionPath);
  if (existingRuntime) {
    touchRuntime(persistedSessionPath);
    return existingRuntime.runtimePromise;
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
      touchRuntime(runtimeKey);
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
