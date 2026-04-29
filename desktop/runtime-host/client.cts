import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesktopEvent } from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
  RuntimeHostToMainMessage,
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

function killAllRuntimeHosts() {
  for (const host of hosts) {
    host.process?.kill();
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

function getRuntimeHostPath() {
  return fileURLToPath(new URL("./worker.mjs", import.meta.url));
}

function isExecutableFile(filePath: string) {
  try {
    return existsSync(filePath);
  } catch {
    return false;
  }
}

function discoverNodeFromShell() {
  const shells = [process.env.SHELL, "/bin/bash", "/bin/zsh", "/bin/sh"].filter(
    (shell): shell is string => Boolean(shell),
  );
  for (const shell of [...new Set(shells)]) {
    if (!isExecutableFile(shell)) continue;
    const result = spawnSync(shell, ["-lc", "command -v node"], {
      encoding: "utf8",
      timeout: 2_000,
    });
    const candidate = result.stdout.trim().split("\n")[0];
    if (candidate && path.isAbsolute(candidate) && isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function getNodeExecutable() {
  for (const candidate of [process.env.HOWCODE_NODE_PATH, process.env.NODE]) {
    const normalized = candidate?.trim();
    if (normalized) return normalized;
  }

  const shellNode = discoverNodeFromShell();
  if (shellNode) return shellNode;

  // Do not use Electron's process.execPath here: it would put native extensions back on the
  // Electron ABI. If discovery reaches this fallback, spawn will fail with a clear host error.
  return "node";
}

function getElectronResourcesPath() {
  const processWithResourcesPath = process as NodeJS.Process & { resourcesPath?: string };
  return (
    process.env.HOWCODE_ELECTRON_RESOURCES_PATH?.trim() ||
    processWithResourcesPath.resourcesPath ||
    ""
  );
}

function getBundledSkillsPath() {
  const resourcesPath = getElectronResourcesPath();
  return resourcesPath ? path.join(resourcesPath, "resources", "skills") : "";
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
    host.process?.kill();
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

async function ensureRuntimeHost(host: HostConnection) {
  registerHostShutdownHandlers();
  if (host.process && !host.process.killed && host.process.exitCode === null) {
    clearHostIdleTimer(host);
    return host.process;
  }

  if (host.startPromise) {
    return host.startPromise;
  }

  clearHostIdleTimer(host);
  host.startPromise = new Promise((resolve, reject) => {
    const child = spawn(getNodeExecutable(), [getRuntimeHostPath()], {
      cwd: getDesktopWorkingDirectory(),
      env: {
        ...process.env,
        HOWCODE_REPO_ROOT: getDesktopWorkingDirectory(),
        HOWCODE_ELECTRON_RESOURCES_PATH: getElectronResourcesPath(),
        HOWCODE_BUNDLED_SKILLS_PATH: getBundledSkillsPath(),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    let settled = false;
    const settleFailure = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      host.startPromise = null;
      host.process = null;
      reject(error);
    };

    child.once("spawn", () => {
      settled = true;
      host.process = child;
      host.startPromise = null;
      resolve(child);
    });
    child.once("error", settleFailure);
    child.once("exit", (code, signal) => {
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
    child.on("message", (message) => handleHostMessage(host, message as RuntimeHostToMainMessage));
    child.stdout?.on("data", (chunk) => process.stdout.write(`[pi-host:${host.label}] ${chunk}`));
    child.stderr?.on("data", (chunk) => process.stderr.write(`[pi-host:${host.label}] ${chunk}`));
  });

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
  if (name === "getComposerSlashCommands" && !getRequestSessionPath(name, payload)) return false;
  return Boolean(getRequestSessionPath(name, payload));
}

function getHostForRequest<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
) {
  const sessionPath = getRequestSessionPath(name, payload);
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
