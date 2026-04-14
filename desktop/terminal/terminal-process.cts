import type { TerminalOpenRequest } from "../../shared/terminal-contracts.ts";
import { clampHistory, flushSession, nowIso, persistSession } from "./session-history.cts";
import type { TerminalSessionRecord } from "./session-record.cts";
import { emitTerminalEvent, getTerminalSession } from "./session-store.cts";
import { getTerminalAdapter, resolveTerminalCommand } from "./terminal-command.cts";

export function clearSessionBindings(record: TerminalSessionRecord) {
  for (const dispose of record.cleanup) {
    dispose();
  }

  record.cleanup = [];
}

export async function startProcess(record: TerminalSessionRecord, reason: "started" | "restarted") {
  clearSessionBindings(record);
  const adapter = getTerminalAdapter();
  const command = resolveTerminalCommand({
    projectId: record.snapshot.projectId,
    sessionPath: record.snapshot.sessionPath,
    cwd: record.snapshot.cwd,
    launchMode: record.snapshot.launchMode,
    cols: record.snapshot.cols,
    rows: record.snapshot.rows,
  } as TerminalOpenRequest);

  try {
    const processHandle = await adapter.spawn({
      shell: command.shell,
      args: command.args,
      cwd: record.snapshot.cwd,
      cols: record.snapshot.cols,
      rows: record.snapshot.rows,
      env: { ...process.env, TERM: "xterm-256color" },
    });

    if (getTerminalSession(record.snapshot.sessionId) !== record) {
      processHandle.kill();
      return;
    }

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
    if (getTerminalSession(record.snapshot.sessionId) !== record) {
      return;
    }

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
