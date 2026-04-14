import { rmSync } from "node:fs";
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
  getTerminalSession,
  listTerminalSessions,
  setTerminalSession,
  subscribeTerminalEvents,
} from "./session-store.cts";
import { clearSessionBindings, startProcess } from "./terminal-process.cts";

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
    }

    return existing.snapshot;
  }

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

  setTerminalSession(sessionId, record);
  void startProcess(record, "started");
  return snapshot;
}

export async function writeTerminal(sessionId: string, data: string) {
  const record = getTerminalSession(sessionId);
  if (!record?.process || !data.length) {
    return;
  }

  record.process.write(data);
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

export async function closeTerminal(request: TerminalCloseRequest) {
  const record = getTerminalSession(request.sessionId);
  if (!record) {
    return;
  }

  clearSessionBindings(record);
  record.process?.kill();
  record.process = null;
  flushSession(record);
  deleteTerminalSession(request.sessionId);

  if (request.deleteHistory) {
    rmSync(record.transcriptPath, { force: true });
  }
}

export { subscribeTerminalEvents };
