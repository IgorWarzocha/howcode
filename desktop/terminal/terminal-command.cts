import { nodePtyAdapter } from "./node-pty.cts";
export { findExecutable, resolveTerminalCommand } from "./terminal-command.helpers.ts";
import type { PtyAdapter } from "./types.cts";

export function getTerminalAdapter(_options?: { platform?: NodeJS.Platform }): PtyAdapter {
  return nodePtyAdapter;
}
