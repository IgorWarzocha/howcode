import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Utils } from "electrobun/bun";
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from "../../shared/terminal-contracts";
import { bunPtyAdapter } from "./bun-pty";
import { nodePtyAdapter } from "./node-pty";
import type { PtyAdapter, PtyProcess } from "./types";

const MAX_HISTORY_CHARS = 200_000;
const TRANSCRIPT_DIR = path.join(Utils.paths.userData, "state", "terminals");

type TerminalSessionRecord = {
  snapshot: TerminalSessionSnapshot;
  process: PtyProcess | null;
  transcriptPath: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
  cleanup: Array<() => void>;
};

const terminalListeners = new Set<(event: TerminalEvent) => void>();
const terminalSessions = new Map<string, TerminalSessionRecord>();

mkdirSync(TRANSCRIPT_DIR, { recursive: true });

function getTerminalAdapter(): PtyAdapter {
  if (process.platform !== "win32" && globalThis.Bun) {
    return bunPtyAdapter;
  }

  return nodePtyAdapter;
}

function nowIso() {
  return new Date().toISOString();
}

function clampHistory(history: string) {
  return history.length > MAX_HISTORY_CHARS ? history.slice(-MAX_HISTORY_CHARS) : history;
}

function emitTerminalEvent(event: TerminalEvent) {
  for (const listener of terminalListeners) {
    listener(event);
  }
}

function makeSessionId(request: TerminalOpenRequest) {
  return Buffer.from(
    JSON.stringify({
      projectId: request.projectId,
      sessionPath: request.sessionPath ?? null,
      cwd: request.cwd ?? request.projectId,
    }),
  ).toString("base64url");
}

function getTranscriptPath(sessionId: string) {
  return path.join(TRANSCRIPT_DIR, `${sessionId}.log`);
}

function readTranscript(transcriptPath: string) {
  try {
    return clampHistory(readFileSync(transcriptPath, "utf8"));
  } catch {
    return "";
  }
}

function persistSession(record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer);
  }

  record.persistTimer = setTimeout(() => {
    writeFileSync(record.transcriptPath, record.snapshot.history, "utf8");
    record.persistTimer = null;
  }, 40);
}

function flushSession(record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer);
    record.persistTimer = null;
  }

  writeFileSync(record.transcriptPath, record.snapshot.history, "utf8");
}

function clearSessionBindings(record: TerminalSessionRecord) {
  for (const dispose of record.cleanup) {
    dispose();
  }

  record.cleanup = [];
}

function resolveShell() {
  if (process.platform === "win32") {
    return {
      shell: process.env.COMSPEC || "powershell.exe",
      args: [] as string[],
    };
  }

  return {
    shell: process.env.SHELL || "/bin/bash",
    args: ["-i"],
  };
}

async function startProcess(record: TerminalSessionRecord, reason: "started" | "restarted") {
  clearSessionBindings(record);
  const adapter = getTerminalAdapter();
  const shell = resolveShell();

  try {
    const processHandle = await adapter.spawn({
      shell: shell.shell,
      args: shell.args,
      cwd: record.snapshot.cwd,
      cols: record.snapshot.cols,
      rows: record.snapshot.rows,
      env: { ...process.env, TERM: "xterm-256color" },
    });

    record.process = processHandle;
    record.snapshot = {
      ...record.snapshot,
      status: "running",
      pid: processHandle.pid,
      exitCode: null,
      exitSignal: null,
      updatedAt: nowIso(),
    };

    record.cleanup.push(
      processHandle.onData((data) => {
        record.snapshot = {
          ...record.snapshot,
          history: clampHistory(record.snapshot.history + data),
          updatedAt: nowIso(),
        };
        persistSession(record);
        emitTerminalEvent({
          type: "output",
          sessionId: record.snapshot.sessionId,
          data,
          createdAt: nowIso(),
        });
      }),
    );

    record.cleanup.push(
      processHandle.onExit((event) => {
        record.process = null;
        clearSessionBindings(record);
        record.snapshot = {
          ...record.snapshot,
          status: "exited",
          pid: null,
          exitCode: event.exitCode,
          exitSignal: event.signal,
          updatedAt: nowIso(),
        };
        flushSession(record);
        emitTerminalEvent({
          type: "exited",
          sessionId: record.snapshot.sessionId,
          exitCode: event.exitCode,
          exitSignal: event.signal,
          createdAt: nowIso(),
        });
      }),
    );

    flushSession(record);
    emitTerminalEvent({
      type: reason,
      sessionId: record.snapshot.sessionId,
      snapshot: record.snapshot,
      createdAt: nowIso(),
    });
  } catch (error) {
    record.process = null;
    record.snapshot = {
      ...record.snapshot,
      status: "error",
      pid: null,
      updatedAt: nowIso(),
    };
    flushSession(record);
    emitTerminalEvent({
      type: "error",
      sessionId: record.snapshot.sessionId,
      message: error instanceof Error ? error.message : "Unable to open terminal.",
      createdAt: nowIso(),
    });
  }
}

export async function openTerminal(request: TerminalOpenRequest): Promise<TerminalSessionSnapshot> {
  const cwd = request.cwd ?? request.projectId;
  const sessionId = makeSessionId(request);
  const existing = terminalSessions.get(sessionId);

  if (existing) {
    existing.snapshot = {
      ...existing.snapshot,
      cols: request.cols,
      rows: request.rows,
      updatedAt: nowIso(),
    };

    if (existing.process) {
      existing.process.resize(request.cols, request.rows);
    }

    return existing.snapshot;
  }

  const snapshot: TerminalSessionSnapshot = {
    sessionId,
    projectId: request.projectId,
    sessionPath: request.sessionPath ?? null,
    cwd,
    status: "starting",
    pid: null,
    cols: request.cols,
    rows: request.rows,
    history: readTranscript(getTranscriptPath(sessionId)),
    exitCode: null,
    exitSignal: null,
    updatedAt: nowIso(),
  };

  const record: TerminalSessionRecord = {
    snapshot,
    process: null,
    transcriptPath: getTranscriptPath(sessionId),
    persistTimer: null,
    cleanup: [],
  };

  terminalSessions.set(sessionId, record);
  await startProcess(record, "started");
  return record.snapshot;
}

export async function writeTerminal(sessionId: string, data: string) {
  const record = terminalSessions.get(sessionId);
  if (!record?.process || !data.length) {
    return;
  }

  record.process.write(data);
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number) {
  const record = terminalSessions.get(sessionId);
  if (!record) {
    return;
  }

  record.snapshot = { ...record.snapshot, cols, rows, updatedAt: nowIso() };
  record.process?.resize(cols, rows);
}

export async function closeTerminal(request: TerminalCloseRequest) {
  const record = terminalSessions.get(request.sessionId);
  if (!record) {
    return;
  }

  clearSessionBindings(record);
  record.process?.kill();
  record.process = null;
  flushSession(record);
  terminalSessions.delete(request.sessionId);

  if (request.deleteHistory) {
    rmSync(record.transcriptPath, { force: true });
  }
}

export function subscribeTerminalEvents(listener: (event: TerminalEvent) => void) {
  terminalListeners.add(listener);
  return () => {
    terminalListeners.delete(listener);
  };
}
