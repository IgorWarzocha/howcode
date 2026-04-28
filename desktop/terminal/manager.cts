import { rmSync } from "node:fs";
import { stat } from "node:fs/promises";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import type {
  TerminalCloseRequest,
  TerminalOpenRequest,
  TerminalSessionSnapshot,
} from "../../shared/terminal-contracts.ts";
import { flushSession, getTranscriptPath, nowIso, readTranscript } from "./session-history.cts";
import { makeSessionId } from "./session-id.cts";
import type { TerminalSessionRecord } from "./session-record.cts";
import {
  deleteTerminalSession,
  emitTerminalEvent,
  getTerminalSession,
  listTerminalSessions,
  setTerminalSession,
  subscribeTerminalEvents,
} from "./session-store.cts";
import { clearSessionBindings, startProcess } from "./terminal-process.cts";
import { hasVisibleTerminalContent } from "./terminal-visibility.cts";

function applyTerminalInputToBuffer(buffer: string, data: string) {
  let nextBuffer = buffer;
  const submittedLines: string[] = [];

  for (const char of data) {
    if (char === "\r" || char === "\n") {
      submittedLines.push(nextBuffer);
      nextBuffer = "";
      continue;
    }

    if (char === "\u0003" || char === "\u0015") {
      nextBuffer = "";
      continue;
    }

    if (char === "\b" || char === "\u007f") {
      nextBuffer = nextBuffer.slice(0, -1);
      continue;
    }

    if (char >= " ") {
      nextBuffer += char;
    }
  }

  return { nextBuffer, submittedLines };
}

function clearTerminalHistory(record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer);
    record.persistTimer = null;
  }

  record.snapshot = {
    ...record.snapshot,
    history: "",
    hasVisibleContent: false,
    updatedAt: nowIso(),
  };
  record.suppressOutputVisibilityUntilInput = true;
  rmSync(record.transcriptPath, { force: true });
  emitTerminalEvent({
    type: "cleared",
    sessionId: record.snapshot.sessionId,
    snapshot: record.snapshot,
    createdAt: nowIso(),
  });
}

function markTerminalVisible(record: TerminalSessionRecord) {
  if (record.snapshot.hasVisibleContent) {
    return;
  }

  record.snapshot = {
    ...record.snapshot,
    hasVisibleContent: true,
    updatedAt: nowIso(),
  };
  emitTerminalEvent({
    type: "updated",
    sessionId: record.snapshot.sessionId,
    snapshot: record.snapshot,
    createdAt: nowIso(),
  });
}

function isRestartableTerminalStatus(status: TerminalSessionSnapshot["status"]) {
  return status === "exited" || status === "error";
}

function ensureProcessStarted(record: TerminalSessionRecord, reason: "started" | "restarted") {
  if (record.process) {
    return Promise.resolve();
  }

  if (record.restartPromise) {
    return record.restartPromise;
  }

  record.restartPromise = startProcess(record, reason).finally(() => {
    record.restartPromise = null;
  });
  return record.restartPromise;
}

export async function openTerminal(request: TerminalOpenRequest): Promise<TerminalSessionSnapshot> {
  const cwd = request.cwd ?? request.projectId;
  const sessionId = makeSessionId(request);
  const existing = getTerminalSession(sessionId);

  if (existing) {
    existing.snapshot = {
      ...existing.snapshot,
      cols: request.cols,
      rows: request.rows,
      updatedAt: nowIso(),
    };

    if (existing.process) {
      existing.process.resize(request.cols, request.rows);
    } else if (isRestartableTerminalStatus(existing.snapshot.status)) {
      existing.snapshot = {
        ...existing.snapshot,
        status: "starting",
        exitCode: null,
        exitSignal: null,
        updatedAt: nowIso(),
      };
      void ensureProcessStarted(existing, "restarted");
    }

    return existing.snapshot;
  }

  const history = readTranscript(getTranscriptPath(sessionId));
  const snapshot: TerminalSessionSnapshot = {
    sessionId,
    projectId: request.projectId,
    sessionPath: request.sessionPath ?? null,
    cwd,
    launchMode: request.launchMode ?? "shell",
    status: "starting",
    pid: null,
    cols: request.cols,
    rows: request.rows,
    history,
    hasVisibleContent:
      (request.launchMode ?? "shell") === "shell" || hasVisibleTerminalContent(history),
    exitCode: null,
    exitSignal: null,
    updatedAt: nowIso(),
  };

  const record: TerminalSessionRecord = {
    snapshot,
    process: null,
    restartPromise: null,
    transcriptPath: getTranscriptPath(sessionId),
    inputBuffer: "",
    suppressOutputVisibilityUntilInput: false,
    persistTimer: null,
    cleanup: [],
  };

  setTerminalSession(sessionId, record);
  void ensureProcessStarted(record, "started");
  return snapshot;
}

export async function writeTerminal(sessionId: string, data: string) {
  const record = getTerminalSession(sessionId);
  const input = record ? applyTerminalInputToBuffer(record.inputBuffer, data) : null;

  if (record && input) {
    record.inputBuffer = input.nextBuffer;
    if (input.submittedLines.some((line) => line.trim() && line.trim() !== "clear")) {
      record.suppressOutputVisibilityUntilInput = false;
      markTerminalVisible(record);
    }
  }

  if (!record?.process || !data.length) {
    if (record && data.length && isRestartableTerminalStatus(record.snapshot.status)) {
      record.snapshot = {
        ...record.snapshot,
        status: "starting",
        exitCode: null,
        exitSignal: null,
        updatedAt: nowIso(),
      };
      await ensureProcessStarted(record, "restarted");
      record.process?.write(data);
      if (input?.submittedLines.some((line) => line.trim() === "clear")) {
        clearTerminalHistory(record);
      }
    }
    return;
  }

  record.process.write(data);

  if (input?.submittedLines.some((line) => line.trim() === "clear")) {
    clearTerminalHistory(record);
  }
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number) {
  const record = getTerminalSession(sessionId);
  if (!record) {
    return;
  }

  record.snapshot = { ...record.snapshot, cols, rows, updatedAt: nowIso() };
  record.process?.resize(cols, rows);
}

export async function listTerminals(): Promise<TerminalSessionSnapshot[]> {
  return listTerminalSessions().map((record) => record.snapshot);
}

export async function getTerminalStatus(sessionId: string) {
  const record = getTerminalSession(sessionId);
  return record ? { sessionId, status: record.snapshot.status } : null;
}

export async function statSessionFile(sessionId: string) {
  const record = getTerminalSession(sessionId);
  const persistedSessionPath = getPersistedSessionPath(record?.snapshot.sessionPath ?? null);
  if (!persistedSessionPath) {
    return null;
  }

  try {
    const fileStat = await stat(persistedSessionPath);
    if (!fileStat.isFile()) {
      return null;
    }

    return {
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    };
  } catch {
    return null;
  }
}

export async function closeTerminal(request: TerminalCloseRequest) {
  const record = getTerminalSession(request.sessionId);
  if (!record) {
    return;
  }

  clearSessionBindings(record);
  record.process?.kill();
  record.process = null;
  record.restartPromise = null;
  flushSession(record);
  deleteTerminalSession(request.sessionId);

  if (request.deleteHistory) {
    rmSync(record.transcriptPath, { force: true });
  }

  emitTerminalEvent({
    type: "exited",
    sessionId: request.sessionId,
    exitCode: null,
    exitSignal: null,
    createdAt: nowIso(),
  });
}

export { subscribeTerminalEvents };
