import type { TerminalSessionSnapshot } from "../../shared/terminal-contracts";
import type { PtyProcess } from "./types";

export type TerminalSessionRecord = {
  snapshot: TerminalSessionSnapshot;
  process: PtyProcess | null;
  transcriptPath: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
  cleanup: Array<() => void>;
};
