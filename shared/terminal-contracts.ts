export type TerminalStatus = "starting" | "running" | "exited" | "error";

export type TerminalOpenRequest = {
  projectId: string;
  sessionPath?: string | null;
  cwd?: string | null;
  launchMode?: "shell" | "pi-session";
  cols: number;
  rows: number;
  env?: Record<string, string>;
};

export type TerminalWriteRequest = {
  sessionId: string;
  data: string;
};

export type TerminalResizeRequest = {
  sessionId: string;
  cols: number;
  rows: number;
};

export type TerminalCloseRequest = {
  sessionId: string;
  deleteHistory?: boolean;
};

export type TerminalSessionFileStatRequest = {
  sessionId: string;
};

export type TerminalSessionFileStat = {
  mtimeMs: number;
  size: number;
};

export type TerminalStatusRequest = {
  sessionId: string;
};

export type TerminalStatusSnapshot = {
  sessionId: string;
  status: TerminalStatus;
} | null;

export type TerminalSessionSnapshot = {
  sessionId: string;
  projectId: string;
  sessionPath: string | null;
  cwd: string;
  launchMode: "shell" | "pi-session";
  status: TerminalStatus;
  pid: number | null;
  cols: number;
  rows: number;
  history: string;
  exitCode: number | null;
  exitSignal: number | null;
  updatedAt: string;
};

type TerminalEventBase = {
  sessionId: string;
  createdAt: string;
};

export type TerminalStartedEvent = TerminalEventBase & {
  type: "started" | "restarted";
  snapshot: TerminalSessionSnapshot;
};

export type TerminalOutputEvent = TerminalEventBase & {
  type: "output";
  data: string;
};

export type TerminalExitedEvent = TerminalEventBase & {
  type: "exited";
  exitCode: number | null;
  exitSignal: number | null;
};

export type TerminalErrorEvent = TerminalEventBase & {
  type: "error";
  message: string;
};

export type TerminalClearedEvent = TerminalEventBase & {
  type: "cleared";
};

export type TerminalEvent =
  | TerminalStartedEvent
  | TerminalOutputEvent
  | TerminalExitedEvent
  | TerminalErrorEvent
  | TerminalClearedEvent;
