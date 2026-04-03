import { constants, accessSync } from "node:fs";
import path from "node:path";
import type { TerminalOpenRequest } from "../../shared/terminal-contracts";
import { bunPtyAdapter } from "./bun-pty";
import { nodePtyAdapter } from "./node-pty";
import type { PtyAdapter } from "./types";

export function getTerminalAdapter(options?: {
  platform?: NodeJS.Platform;
  hasBun?: boolean;
}): PtyAdapter {
  const platform = options?.platform ?? process.platform;
  const hasBun = options?.hasBun ?? Boolean(globalThis.Bun);

  if (platform !== "win32" && hasBun) {
    return bunPtyAdapter;
  }

  return nodePtyAdapter;
}

export function findExecutable(name: string, pathValue = process.env.PATH ?? "") {
  const pathEntries = pathValue.split(path.delimiter);

  for (const entry of pathEntries) {
    if (!entry) {
      continue;
    }

    const candidate = path.join(entry, name);

    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return name;
}

export function resolveTerminalCommand(
  request: TerminalOpenRequest,
  options?: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv },
) {
  const platform = options?.platform ?? process.platform;
  const env = options?.env ?? process.env;

  if (request.launchMode === "pi-session") {
    const executable =
      platform === "win32"
        ? findExecutable("pi.cmd", env.PATH ?? "")
        : findExecutable("pi", env.PATH ?? "");

    return {
      shell: executable,
      args: request.sessionPath ? ["--session", request.sessionPath] : ["--continue"],
    };
  }

  if (platform === "win32") {
    return {
      shell: env.COMSPEC || "powershell.exe",
      args: [] as string[],
    };
  }

  return {
    shell: env.SHELL || "/bin/bash",
    args: ["-i"],
  };
}
