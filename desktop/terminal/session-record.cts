import type { TerminalSessionSnapshot } from "../../shared/terminal-contracts.ts";
import type { PtyProcess } from "./types.cts";

export type TerminalSessionRecord = {
  snapshot: TerminalSessionSnapshot;
  process: PtyProcess | null;
  restartPromise: Promise<void> | null;
  transcriptPath: string;
  inputBuffer: string;
  suppressOutputVisibilityUntilInput: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
  cleanup: Array<() => void>;
};
