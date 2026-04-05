import type { TerminalSessionSnapshot } from "../../shared/terminal-contracts.ts";
import type { PtyProcess } from "./types.cts";

export type TerminalSessionRecord = {
  snapshot: TerminalSessionSnapshot;
  process: PtyProcess | null;
  transcriptPath: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
  cleanup: Array<() => void>;
};
