import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { DesktopEvent } from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import {
  createArtifact,
  editArtifact,
  getArtifact,
  listArtifacts,
  updateArtifact,
} from "../artifact-state-db.cts";
import {
  getBundledSkillsPath,
  getElectronResourcesPath,
  getNodeExecutable,
  getRuntimeHostPath,
} from "./client-environment.cts";
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
  RuntimeHostToMainMessage,
  RuntimeHostMainRequestMessage,
} from "./protocol.cts";

type PendingRequest = {
  name: RuntimeHostRequestName;
  resolve: (value: RuntimeHostResponseMap[RuntimeHostRequestName]) => void;
  reject: (error: Error) => void;
};

type HostRole = "service" | "thread";

type HostConnection = {
  id: string;
  role: HostRole;
  label: string;
  aliases: Set<string>;
  pendingRequests: Map<string, PendingRequest>;
  process: ChildProcess | null;
  startPromise: Promise<ChildProcess> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  busy: boolean;
};

type RuntimeHostBrokerState = {
  desktopListeners: Set<(event: DesktopEvent) => void>;
  hostByAlias: Map<string, HostConnection>;
  hosts: Set<HostConnection>;
  serviceHost: HostConnection | null;
};

const brokerStateKey = Symbol.for("howcode.runtimeHostBrokerState");
const runtimeHostGlobal = globalThis as typeof globalThis & {
  [brokerStateKey]?: RuntimeHostBrokerState;
};

if (!runtimeHostGlobal[brokerStateKey]) {
  runtimeHostGlobal[brokerStateKey] = {
    desktopListeners: new Set<(event: DesktopEvent) => void>(),
    hostByAlias: new Map<string, HostConnection>(),
    hosts: new Set<HostConnection>(),
    serviceHost: null,
  };
}

const brokerState = runtimeHostGlobal[brokerStateKey];

const desktopListeners = brokerState.desktopListeners;
const hostByAlias = brokerState.hostByAlias;
const hosts = brokerState.hosts;

const THREAD_HOST_IDLE_MS = 5 * 60 * 1000;

let registeredHostShutdownHandlers = false;
let runtimeHostsShuttingDown = false;

function terminateHostProcess(child: ChildProcess | null | undefined) {
  if (!child || child.killed || child.exitCode !== null) return;

  if (process.platform === "win32" && child.pid) {
    const taskkill = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    taskkill.unref();
    return;
  }

  child.kill("SIGTERM");
}

function killAllRuntimeHosts() {
  for (const host of hosts) {
    terminateHostProcess(host.process);
  }
}

function registerHostShutdownHandlers() {
  if (registeredHostShutdownHandlers) return;
  registeredHostShutdownHandlers = true;
  process.once("exit", killAllRuntimeHosts);
  process.once("SIGTERM", () => {
    killAllRuntimeHosts();
    process.exit(0);
  });
  process.once("SIGINT", () => {
    killAllRuntimeHosts();
    process.exit(0);
  });
}

const serviceHost: HostConnection =
  brokerState.serviceHost ?? createHostConnection("service", "service");
brokerState.serviceHost = serviceHost;

function createHostConnection(role: HostRole, label: string): HostConnection {
  const host: HostConnection = {
    id: randomUUID(),
    role,
    label,
    aliases: new Set(),
    pendingRequests: new Map(),
    process: null,
    startPromise: null,
    idleTimer: null,
    busy: false,
  };
  hosts.add(host);
  return host;
}

function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event);
  }
}

function rejectPendingRequests(host: HostConnection, error: Error) {
  host.busy = false;
  for (const [, pending] of host.pendingRequests) {
    pending.reject(error);
  }
  host.pendingRequests.clear();
}

export function shutdownRuntimeHosts() {
  runtimeHostsShuttingDown = true;

  for (const host of hosts) {
    if (host.idleTimer) {
      clearTimeout(host.idleTimer);
      host.idleTimer = null;
    }
    rejectPendingRequests(host, new Error("Pi runtime host is shutting down."));
    terminateHostProcess(host.process);
    host.process = null;
    host.startPromise = null;
  }

  hostByAlias.clear();
  hosts.clear();
  hosts.add(serviceHost);
}

function rememberHostAlias(host: HostConnection, alias: string | null | undefined) {
  const normalized = alias?.trim();
  if (!normalized) return;
  host.aliases.add(normalized);
  hostByAlias.set(normalized, host);
}

function forgetHost(host: HostConnection) {
  for (const alias of host.aliases) {
    if (hostByAlias.get(alias) === host) {
      hostByAlias.delete(alias);
    }
  }
  host.aliases.clear();
  if (host !== serviceHost) {
    hosts.delete(host);
  }
}

function scheduleThreadHostIdleStop(host: HostConnection) {
  if (host.role !== "thread" || host.pendingRequests.size > 0 || host.busy) return;
  if (host.idleTimer) clearTimeout(host.idleTimer);
  host.idleTimer = setTimeout(() => {
    if (host.pendingRequests.size > 0) return;
    terminateHostProcess(host.process);
    forgetHost(host);
  }, THREAD_HOST_IDLE_MS);
}

function clearHostIdleTimer(host: HostConnection) {
  if (!host.idleTimer) return;
  clearTimeout(host.idleTimer);
  host.idleTimer = null;
}

function isHostRunningOrStarting(host: HostConnection) {
  return Boolean(
    host.startPromise || (host.process && !host.process.killed && host.process.exitCode === null),
  );
}

function handleHostMessage(host: HostConnection, message: RuntimeHostToMainMessage) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "desktop-event") {
    if (message.event.type === "thread-update") {
      rememberHostAlias(host, message.event.sessionPath);
      host.busy = message.event.thread.isStreaming || message.event.thread.isCompacting;
      if (host.busy) {
        clearHostIdleTimer(host);
      } else {
        scheduleThreadHostIdleStop(host);
      }
    }
    emitDesktopEvent(message.event);
    return;
  }

  if (message.type === "host-error") {
    console.error(`Pi runtime host error (${host.label})`, message.error, message.stack);
    return;
  }

  if (message.type === "main-request") {
    void handleHostMainRequest(host, message);
    return;
  }

  if (message.type === "response") {
    const pending = host.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    host.pendingRequests.delete(message.id);
    if (pending.name === "sendComposerPrompt" && (!message.ok || message.result !== "sent")) {
      host.busy = false;
    }
    scheduleThreadHostIdleStop(host);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      const error = new Error(message.error);
      if (message.stack) {
        error.stack = message.stack;
      }
      pending.reject(error);
    }
  }
}

async function handleHostMainRequest(host: HostConnection, message: RuntimeHostMainRequestMessage) {
  try {
    let result: unknown;
    switch (message.name) {
      case "createArtifact": {
        const payload = message.payload as Parameters<typeof createArtifact>[0];
        result = createArtifact(payload);
        break;
      }
      case "updateArtifact": {
        const payload = message.payload as Parameters<typeof updateArtifact>[0];
        result = updateArtifact(payload);
        break;
      }
      case "editArtifact": {
        const payload = message.payload as Parameters<typeof editArtifact>[0];
        result = editArtifact(payload);
        break;
      }
      case "getArtifact": {
        const payload = message.payload as { artifactSlug: string; conversationId?: string | null };
        result = getArtifact(payload.artifactSlug, payload.conversationId);
        break;
      }
      case "listArtifacts": {
        const payload = message.payload as { conversationId: string };
        result = listArtifacts(payload.conversationId);
        break;
      }
      default:
        throw new Error(`Unknown runtime host main request: ${message.name}`);
    }
    host.process?.send?.({ type: "main-response", id: message.id, ok: true, result });
  } catch (error) {
    host.process?.send?.({
      type: "main-response",
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function ensureRuntimeHost(host: HostConnection) {
  if (runtimeHostsShuttingDown) {
    throw new Error("Pi runtime host is shutting down.");
  }

  registerHostShutdownHandlers();
  if (host.process && !host.process.killed && host.process.exitCode === null) {
    clearHostIdleTimer(host);
    return host.process;
  }

  if (host.startPromise) {
    return host.startPromise;
  }

  clearHostIdleTimer(host);
  host.startPromise = (async () => {
    const nodeExecutable = await getNodeExecutable();
    if (runtimeHostsShuttingDown) {
      throw new Error("Pi runtime host is shutting down.");
    }

    return await new Promise<ChildProcess>((resolve, reject) => {
      const child = spawn(nodeExecutable, [getRuntimeHostPath()], {
        cwd: getDesktopWorkingDirectory(),
        env: {
          ...process.env,
          HOWCODE_REPO_ROOT: getDesktopWorkingDirectory(),
          HOWCODE_ELECTRON_RESOURCES_PATH: getElectronResourcesPath(),
          HOWCODE_BUNDLED_SKILLS_PATH: getBundledSkillsPath(),
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      }) as ChildProcess;

      let settled = false;
      const settleFailure = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        host.startPromise = null;
        host.process = null;
        if (host.role === "thread") {
          forgetHost(host);
        }
        reject(error);
      };

      child.once("spawn", () => {
        if (runtimeHostsShuttingDown) {
          terminateHostProcess(child);
          settleFailure(new Error("Pi runtime host is shutting down."));
          return;
        }

        settled = true;
        host.process = child;
        host.startPromise = null;
        resolve(child);
      });
      child.once("error", settleFailure);
      child.once("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        if (host.process === child) {
          host.process = null;
        }
        host.startPromise = null;
        rejectPendingRequests(
          host,
          new Error(
            `Pi runtime host ${host.label} exited${code !== null ? ` with code ${code}` : ""}${signal ? ` (${signal})` : ""}.`,
          ),
        );
        if (host.role === "thread") {
          forgetHost(host);
        }
      });
      child.on("message", (message: unknown) =>
        handleHostMessage(host, message as RuntimeHostToMainMessage),
      );
      child.stdout?.on("data", (chunk: Buffer | string) =>
        process.stdout.write(`[pi-host:${host.label}] ${chunk}`),
      );
      child.stderr?.on("data", (chunk: Buffer | string) =>
        process.stderr.write(`[pi-host:${host.label}] ${chunk}`),
      );
    });
  })();

  return host.startPromise;
}

function getRequestSessionPath<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  if (name === "startNewThread" || name === "selectProjectRuntime") return null;
  if ("request" in payload) return payload.request.sessionPath ?? null;
  if ("sessionPath" in payload) return payload.sessionPath ?? null;
  return null;
}

function shouldUseThreadHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  if (name === "startNewThread" || name === "selectProjectRuntime") return false;
  if (name === "loadThreadSnapshot") return false;
  if (name === "getComposerSlashCommands" && !getRequestSessionPath(name, payload)) return false;
  return Boolean(getPersistedSessionPath(getRequestSessionPath(name, payload)));
}

function getHostForRequest<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  const sessionPath = getPersistedSessionPath(getRequestSessionPath(name, payload));
  if (!shouldUseThreadHost(name, payload)) {
    return serviceHost;
  }

  const existingHost = sessionPath ? hostByAlias.get(sessionPath) : null;
  if (existingHost) {
    return existingHost;
  }

  const host = createHostConnection("thread", sessionPath ?? `thread-${hosts.size}`);
  rememberHostAlias(host, sessionPath);
  return host;
}

export async function invokeRuntimeHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  const host = getHostForRequest(name, payload);
  const child = await ensureRuntimeHost(host);
  const id = randomUUID();

  return await new Promise<RuntimeHostResponseMap[TName]>((resolve, reject) => {
    if (name === "sendComposerPrompt") {
      host.busy = true;
      clearHostIdleTimer(host);
    }

    host.pendingRequests.set(id, {
      name,
      resolve: (value) => resolve(value as RuntimeHostResponseMap[TName]),
      reject,
    });

    child.send({ type: "request", id, name, payload }, (error) => {
      if (!error) {
        return;
      }
      host.pendingRequests.delete(id);
      if (name === "sendComposerPrompt") {
        host.busy = false;
      }
      scheduleThreadHostIdleStop(host);
      reject(error);
    });
  });
}

export async function invalidateRuntimeHostSettings(
  request: {
    sessionPath?: string | null;
    projectPath?: string | null;
  } = {},
) {
  const targets = new Set<HostConnection>();
  if (request.sessionPath) {
    const host = hostByAlias.get(request.sessionPath);
    if (host) targets.add(host);
  } else {
    for (const host of hosts) targets.add(host);
  }

  await Promise.all(
    [...targets].filter(isHostRunningOrStarting).map((host) =>
      invokeRuntimeHostOnHost(host, "invalidateRuntimeSettings", request).catch((error) => {
        console.warn(`Failed to invalidate Pi runtime host settings (${host.label}).`, error);
      }),
    ),
  );
}

async function invokeRuntimeHostOnHost<TName extends RuntimeHostRequestName>(
  host: HostConnection,
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  const child = await ensureRuntimeHost(host);
  const id = randomUUID();

  return await new Promise<RuntimeHostResponseMap[TName]>((resolve, reject) => {
    host.pendingRequests.set(id, {
      name,
      resolve: (value) => resolve(value as RuntimeHostResponseMap[TName]),
      reject,
    });

    child.send({ type: "request", id, name, payload }, (error) => {
      if (!error) return;
      host.pendingRequests.delete(id);
      scheduleThreadHostIdleStop(host);
      reject(error);
    });
  });
}

export function subscribeRuntimeHostEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener);
  void ensureRuntimeHost(serviceHost).catch((error) => {
    console.error("Failed to start Pi runtime service host for desktop events.", error);
  });
  return () => {
    desktopListeners.delete(listener);
  };
}
