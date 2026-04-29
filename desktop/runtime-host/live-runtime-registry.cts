import path from "node:path";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { getPiModule } from "../pi-module.cts";
import { bindHeadlessAgentSessionExtensions } from "../runtime/agent-session-extensions.cts";
import { buildComposerState } from "../runtime/composer-state.cts";
import type { PiRuntime } from "../runtime/types.cts";
import {
  cancelLiveThreadUpdate,
  deferLiveThreadUpdate,
  publishComposerUpdate,
  publishThreadUpdate,
  scheduleLiveThreadUpdate,
} from "./live-thread-publisher.cts";
import { clearRuntimeToolProgress, rememberRuntimeToolProgress } from "./live-tool-progress.cts";

type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
};

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;

const runtimeRecords = new Map<string, RuntimeRecord>();
const runtimeMutationTails = new Map<string, Promise<void>>();
const staleRuntimeKeys = new Set<string>();

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
        if (runtime.session.isStreaming || runtime.session.isCompacting) {
          scheduleRuntimeDisposal(runtimeKey);
          return;
        }
        runtime.session.dispose();
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
        staleRuntimeKeys.delete(runtimeKey);
      } catch {
        if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
        staleRuntimeKeys.delete(runtimeKey);
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
  staleRuntimeKeys.delete(runtimeKey);
  const record: RuntimeRecord = { runtimePromise, disposeTimeout: null };
  runtimeRecords.set(runtimeKey, record);
  return record;
}

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath || staleRuntimeKeys.has(persistedSessionPath)) return null;
  return runtimeRecords.get(persistedSessionPath)?.runtimePromise ?? null;
}

export async function getCachedRuntimeForRead(sessionPath: string) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath) return null;
  const record = runtimeRecords.get(persistedSessionPath);
  if (!record) return null;
  if (!staleRuntimeKeys.has(persistedSessionPath)) return record.runtimePromise;
  const runtime = await record.runtimePromise;
  return runtime.session.isStreaming || runtime.session.isCompacting ? runtime : null;
}

export async function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: { suspendDisposal?: boolean } = {},
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  if (!persistedSessionPath)
    throw new Error("A persisted session path is required to open a live runtime.");
  const existingRuntime = runtimeRecords.get(persistedSessionPath);
  if (existingRuntime) {
    const runtime = await existingRuntime.runtimePromise;
    if (!staleRuntimeKeys.has(persistedSessionPath)) {
      if (options.suspendDisposal) suspendRuntimeDisposal(persistedSessionPath);
      return runtime;
    }
    if (runtime.session.isStreaming || runtime.session.isCompacting) {
      if (options.suspendDisposal) suspendRuntimeDisposal(persistedSessionPath);
      return runtime;
    }
    await invalidateRuntimeRecord(persistedSessionPath, existingRuntime);
  }
  const { SessionManager } = await getPiModule();
  const sessionManager = SessionManager.open(persistedSessionPath);
  let record: RuntimeRecord | null = null;
  const runtimePromise = createRuntime({ cwd: sessionManager.getCwd(), sessionManager }).catch(
    (error) => {
      if (record && runtimeRecords.get(persistedSessionPath) === record)
        runtimeRecords.delete(persistedSessionPath);
      staleRuntimeKeys.delete(persistedSessionPath);
      throw error;
    },
  );
  record = registerRuntime(persistedSessionPath, runtimePromise);
  return runtimePromise;
}

export async function createRuntimeForNewSession(cwd: string) {
  const runtime = await createRuntime({ cwd });
  const runtimeKey = getPersistedSessionPath(runtime.session.sessionFile);
  if (runtimeKey) registerRuntime(runtimeKey, Promise.resolve(runtime));
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

async function invalidateRuntimeRecord(runtimeKey: string, record: RuntimeRecord) {
  let runtime: PiRuntime;
  try {
    runtime = await record.runtimePromise;
  } catch {
    if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
    staleRuntimeKeys.delete(runtimeKey);
    return;
  }

  staleRuntimeKeys.add(runtimeKey);

  if (runtime.session.isStreaming || runtime.session.isCompacting) {
    // Do not kill an active run. The next end/compaction event schedules immediate idle disposal
    // because this runtime key is marked stale.
    clearRuntimeDisposeTimeout(runtimeKey);
    return;
  }

  clearRuntimeDisposeTimeout(runtimeKey);
  if (runtimeRecords.get(runtimeKey) === record) runtimeRecords.delete(runtimeKey);
  staleRuntimeKeys.delete(runtimeKey);
  runtime.session.dispose();
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
    if (record)
      await withRuntimeMutationLock(sessionPath, () =>
        invalidateRuntimeRecord(sessionPath, record),
      );
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
        staleRuntimeKeys.delete(runtimeKey);
        return;
      }
      if (resolvedProjectPath && path.resolve(runtime.cwd) !== resolvedProjectPath) return;
      await withRuntimeMutationLock(runtimeKey, () => invalidateRuntimeRecord(runtimeKey, record));
    }),
  );
  return { ok: true as const };
}

export async function disposeAllRuntimeHosts() {
  const entries = [...runtimeRecords.entries()];
  runtimeRecords.clear();
  staleRuntimeKeys.clear();
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
