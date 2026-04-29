import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { DesktopEvent } from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
  RuntimeHostToMainMessage,
} from "./protocol.cts";

type PendingRequest = {
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

const desktopListeners = new Set<(event: DesktopEvent) => void>();
const hostByAlias = new Map<string, HostConnection>();
const hosts = new Set<HostConnection>();

const THREAD_HOST_IDLE_MS = 5 * 60 * 1000;

const serviceHost: HostConnection = createHostConnection("service", "service");

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
  return new URL("./worker.mjs", import.meta.url).pathname;
}

function getNodeExecutable() {
  return process.env.HOWCODE_NODE_PATH?.trim() || process.env.NODE || "node";
}

function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event);
  }
}

function rejectPendingRequests(host: HostConnection, error: Error) {
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
      resolve: (value) => resolve(value as RuntimeHostResponseMap[TName]),
      reject,
    });

    child.send({ type: "request", id, name, payload }, (error) => {
      if (!error) {
        return;
      }
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
