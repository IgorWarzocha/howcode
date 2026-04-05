import { bunPtyAdapter } from "./bun-pty.cts";
import { nodePtyAdapter } from "./node-pty.cts";
export { findExecutable, resolveTerminalCommand } from "./terminal-command.helpers.ts";
import type { PtyAdapter } from "./types.cts";

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
