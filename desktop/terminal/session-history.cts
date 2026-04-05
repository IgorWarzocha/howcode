import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Utils } from "electrobun/bun";
import { clampHistory } from "./session-history.helpers.ts";
export { clampHistory } from "./session-history.helpers.ts";
import type { TerminalSessionRecord } from "./session-record.cts";

function getTranscriptDirectory() {
  const transcriptDirectory = path.join(Utils.paths.userData, "state", "terminals");
  mkdirSync(transcriptDirectory, { recursive: true });
  return transcriptDirectory;
}

export function nowIso() {
  return new Date().toISOString();
}

export function getTranscriptPath(sessionId: string) {
  return path.join(getTranscriptDirectory(), `${sessionId}.log`);
}

export function readTranscript(transcriptPath: string) {
  try {
    return clampHistory(readFileSync(transcriptPath, "utf8"));
  } catch {
    return "";
  }
}

export function persistSession(record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer);
  }

  record.persistTimer = setTimeout(() => {
    writeFileSync(record.transcriptPath, record.snapshot.history, "utf8");
    record.persistTimer = null;
  }, 40);
}

export function flushSession(record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer);
    record.persistTimer = null;
  }

  writeFileSync(record.transcriptPath, record.snapshot.history, "utf8");
}
