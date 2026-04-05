import type { ComposerStateRequest } from "../../shared/desktop-contracts.ts";
import { captureCompletedTurnDiff } from "../diff/query.cts";
import { getPiModule } from "../pi-module.cts";
import { getMappedCwd, rememberSessionPath } from "./session-path-index.cts";
import { publishThreadUpdate } from "./thread-publisher.cts";
import type { PiRuntime } from "./types.cts";

const runtimePromises = new Map<string, Promise<PiRuntime>>();

async function createRuntime(cwd: string): Promise<PiRuntime> {
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
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const sessionDir = settingsManager.getSessionDir() ?? undefined;
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    settingsManager,
    sessionManager: SessionManager.create(cwd, sessionDir),
  });

  const runtime = {
    cwd,
    session,
    pendingTurnCount: null,
  };

  rememberSessionPath(session.sessionFile, cwd);

  session.subscribe((event) => {
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
      return;
    }

    if (event.type === "message_update" && event.message.role === "assistant") {
      void publishThreadUpdate(runtime, "update");
    }
  });

  return runtime;
}

async function getRuntime(cwd: string) {
  const existingRuntime = runtimePromises.get(cwd);
  if (existingRuntime) {
    return existingRuntime;
  }

  const runtimePromise = createRuntime(cwd);
  runtimePromises.set(cwd, runtimePromise);
  return runtimePromise;
}

async function resolveCwd(request: ComposerStateRequest = {}) {
  if (request.sessionPath) {
    const mappedCwd = getMappedCwd(request.sessionPath);
    if (mappedCwd) {
      return mappedCwd;
    }

    const { SessionManager } = await getPiModule();
    return SessionManager.open(request.sessionPath).getCwd();
  }

  if (request.projectId) {
    return request.projectId;
  }

  return process.cwd();
}

async function activateSession(runtime: PiRuntime, request: ComposerStateRequest = {}) {
  if (request.sessionPath && runtime.session.sessionFile !== request.sessionPath) {
    await runtime.session.switchSession(request.sessionPath);
    rememberSessionPath(runtime.session.sessionFile, runtime.cwd);
  }

  return runtime;
}

export async function getRuntimeForRequest(request: ComposerStateRequest = {}) {
  const cwd = await resolveCwd(request);
  const runtime = await getRuntime(cwd);
  return activateSession(runtime, request);
}

export async function createFreshThreadIfNeeded(runtime: PiRuntime) {
  if (runtime.session.messages.length > 0) {
    await runtime.session.newSession();
    rememberSessionPath(runtime.session.sessionFile, runtime.cwd);
  }
}
