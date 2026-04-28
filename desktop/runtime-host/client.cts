import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import type { DesktopEvent } from "../../shared/desktop-contracts.ts";
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
  RuntimeHostToMainMessage,
} from "./protocol.cts";

const pendingRequests = new Map<
  string,
  {
    resolve: (value: RuntimeHostResponseMap[RuntimeHostRequestName]) => void;
    reject: (error: Error) => void;
  }
>();
const desktopListeners = new Set<(event: DesktopEvent) => void>();

let hostProcess: ChildProcess | null = null;
let hostStartPromise: Promise<ChildProcess> | null = null;

function getRuntimeHostPath() {
  return new URL("./worker.mjs", import.meta.url).pathname;
}

function getNodeExecutable() {
  return process.env.HOWCODE_NODE_PATH?.trim() || process.env.NODE || "node";
}

function rejectPendingRequests(error: Error) {
  for (const [, pending] of pendingRequests) {
    pending.reject(error);
  }
  pendingRequests.clear();
}

function emitDesktopEvent(event: DesktopEvent) {
  for (const listener of desktopListeners) {
    listener(event);
  }
}

function handleHostMessage(message: RuntimeHostToMainMessage) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "desktop-event") {
    emitDesktopEvent(message.event);
    return;
  }

  if (message.type === "host-error") {
    console.error("Pi runtime host error", message.error, message.stack);
    return;
  }

  if (message.type === "response") {
    const pending = pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    pendingRequests.delete(message.id);
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

async function ensureRuntimeHost() {
  if (hostProcess && !hostProcess.killed && hostProcess.exitCode === null) {
    return hostProcess;
  }

  if (hostStartPromise) {
    return hostStartPromise;
  }

  hostStartPromise = new Promise((resolve, reject) => {
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
      hostStartPromise = null;
      hostProcess = null;
      reject(error);
    };

    child.once("spawn", () => {
      settled = true;
      hostProcess = child;
      hostStartPromise = null;
      resolve(child);
    });
    child.once("error", settleFailure);
    child.once("exit", (code, signal) => {
      if (hostProcess === child) {
        hostProcess = null;
      }
      hostStartPromise = null;
      rejectPendingRequests(
        new Error(
          `Pi runtime host exited${code !== null ? ` with code ${code}` : ""}${signal ? ` (${signal})` : ""}.`,
        ),
      );
    });
    child.on("message", (message) => handleHostMessage(message as RuntimeHostToMainMessage));
    child.stdout?.on("data", (chunk) => process.stdout.write(`[pi-host] ${chunk}`));
    child.stderr?.on("data", (chunk) => process.stderr.write(`[pi-host] ${chunk}`));
  });

  return hostStartPromise;
}

export async function invokeRuntimeHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  const child = await ensureRuntimeHost();
  const id = randomUUID();

  return await new Promise<RuntimeHostResponseMap[TName]>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: (value) => resolve(value as RuntimeHostResponseMap[TName]),
      reject,
    });

    child.send({ type: "request", id, name, payload }, (error) => {
      if (!error) {
        return;
      }
      pendingRequests.delete(id);
      reject(error);
    });
  });
}

export function subscribeRuntimeHostEvents(listener: (event: DesktopEvent) => void) {
  desktopListeners.add(listener);
  void ensureRuntimeHost().catch((error) => {
    console.error("Failed to start Pi runtime host for desktop events.", error);
  });
  return () => {
    desktopListeners.delete(listener);
  };
}
