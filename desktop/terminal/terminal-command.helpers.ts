import { constants, accessSync } from "node:fs";
import path from "node:path";
import { getPersistedSessionPath } from "../../shared/session-paths";
import type { TerminalOpenRequest } from "../../shared/terminal-contracts.ts";

const hostTerminalCapabilityEnvKeys = [
  "GHOSTTY_RESOURCES_DIR",
  "ITERM_SESSION_ID",
  "KITTY_WINDOW_ID",
  "TERM_PROGRAM",
  "WEZTERM_PANE",
];

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
    const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
    const executable =
      platform === "win32"
        ? findExecutable("pi.cmd", env.PATH ?? "")
        : findExecutable("pi", env.PATH ?? "");

    return {
      shell: executable,
      args: persistedSessionPath ? ["--session", persistedSessionPath] : [],
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

export function resolveTerminalEnv(
  request: TerminalOpenRequest,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const nextEnv: NodeJS.ProcessEnv = { ...env, TERM: "xterm-256color" };

  if (request.launchMode !== "pi-session") {
    return nextEnv;
  }

  for (const key of hostTerminalCapabilityEnvKeys) {
    delete nextEnv[key];
  }

  nextEnv.TERM_PROGRAM = "howcode";
  nextEnv.COLORTERM = nextEnv.COLORTERM ?? "truecolor";
  nextEnv.HOWCODE_EMBEDDED_TERMINAL = "1";
  nextEnv.PI_CLEAR_ON_SHRINK = "1";
  return nextEnv;
}
