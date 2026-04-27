import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { normalizeThreadTitle } from "../../shared/pi-message-mapper.ts";
import { getPiModule } from "../pi-module.cts";
import { mapWithConcurrency } from "./map-with-concurrency.cts";

export type SessionSummary = {
  id: string;
  name?: string;
  firstMessage?: string;
  modified: Date;
  path: string;
  cwd?: string;
};

type SessionFileEntry = {
  type?: string;
  id?: string;
  timestamp?: string;
  cwd?: string;
  message?: {
    role?: string;
    timestamp?: number;
    content?: string | Array<{ type?: string; text?: string }>;
  };
  name?: string;
};

type SessionSummaryReadResult = {
  summary: SessionSummary | null;
  failed: boolean;
};

type SessionIndexReadResult = {
  sessions: SessionSummary[];
  partialFailure: boolean;
};

const SESSION_SUMMARY_READ_CONCURRENCY = 12;

function isNodeErrorWithCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function readDirectoryIfPresent(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }
}

function getMessageText(entry: SessionFileEntry) {
  const content = entry.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    let text = "";
    for (const block of content) {
      if (block.type !== "text" || typeof block.text !== "string") {
        continue;
      }

      text += text ? ` ${block.text}` : block.text;
    }

    return text;
  }

  return "";
}

function getEntryTimestampMs(entry: SessionFileEntry) {
  if (typeof entry.message?.timestamp === "number") {
    return entry.message.timestamp;
  }

  if (typeof entry.timestamp !== "string") {
    return null;
  }

  const timestampMs = Date.parse(entry.timestamp);
  return Number.isNaN(timestampMs) ? null : timestampMs;
}

function getSessionModifiedDate(
  header: SessionFileEntry,
  lastActivityTimeMs: number | null,
  fileModified: Date,
) {
  if (lastActivityTimeMs !== null) {
    return new Date(lastActivityTimeMs);
  }

  const headerTimestampMs =
    typeof header.timestamp === "string" ? Date.parse(header.timestamp) : Number.NaN;
  return Number.isNaN(headerTimestampMs) ? fileModified : new Date(headerTimestampMs);
}

async function readSessionSummary(filePath: string): Promise<SessionSummaryReadResult> {
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return { summary: null, failed: false };
    }

    console.warn(`Failed to stat session file while refreshing shell index: ${filePath}`, error);
    return { summary: null, failed: true };
  }

  let header: SessionFileEntry | undefined;
  let firstMessage: string | undefined;
  let name: string | undefined;
  let lastActivityTimeMs: number | null = null;

  try {
    const lines = createInterface({
      input: createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let entry: SessionFileEntry;
      try {
        entry = JSON.parse(line) as SessionFileEntry;
      } catch {
        continue;
      }

      header ??= entry;

      if (entry.type === "session_info") {
        name = entry.name?.trim() || undefined;
      }

      if (!firstMessage && entry.type === "message" && entry.message?.role === "user") {
        firstMessage = getMessageText(entry) || undefined;
      }

      if (
        entry.type === "message" &&
        (entry.message?.role === "user" || entry.message?.role === "assistant")
      ) {
        const entryTimestampMs = getEntryTimestampMs(entry);
        if (entryTimestampMs !== null) {
          lastActivityTimeMs = Math.max(lastActivityTimeMs ?? 0, entryTimestampMs);
        }
      }
    }
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return { summary: null, failed: false };
    }

    console.warn(`Failed to read session file while refreshing shell index: ${filePath}`, error);
    return { summary: null, failed: true };
  }

  if (!header || header.type !== "session" || typeof header.id !== "string") {
    console.warn(`Invalid session header while refreshing shell index: ${filePath}`);
    return { summary: null, failed: true };
  }

  return {
    summary: {
      id: header.id,
      cwd: typeof header.cwd === "string" ? header.cwd : undefined,
      path: filePath,
      name,
      firstMessage,
      modified: getSessionModifiedDate(header, lastActivityTimeMs, fileStat.mtime),
    },
    failed: false,
  };
}

export function mapSessionSummaryToRecord(cwd: string, session: SessionSummary) {
  return {
    id: session.id,
    cwd: session.cwd || cwd,
    sessionPath: session.path,
    title: normalizeThreadTitle(session.firstMessage || session.name),
    lastModifiedMs: session.modified.getTime(),
  };
}

export async function listAllSessionsStrict(): Promise<SessionIndexReadResult> {
  const { getAgentDir } = await getPiModule();
  const sessionsDir = path.join(getAgentDir(), "sessions");
  const sessionDirectories = (await readDirectoryIfPresent(sessionsDir)).filter((entry) =>
    entry.isDirectory(),
  );

  const sessionFilePaths: string[] = [];

  const sessionDirectoryResults = await Promise.all(
    sessionDirectories.map(async (sessionDirectory) => {
      const sessionDirectoryPath = path.join(sessionsDir, sessionDirectory.name);

      let sessionFiles: Awaited<ReturnType<typeof readDirectoryIfPresent>>;
      try {
        sessionFiles = await readDirectoryIfPresent(sessionDirectoryPath);
      } catch (error) {
        console.warn(
          `Failed to read session directory while refreshing shell index: ${sessionDirectoryPath}`,
          error,
        );
        return { filePaths: [], failed: true };
      }

      return {
        filePaths: sessionFiles
          .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
          .map((entry) => path.join(sessionDirectoryPath, entry.name)),
        failed: false,
      };
    }),
  );

  let partialFailure = sessionDirectoryResults.some((result) => result.failed);
  for (const result of sessionDirectoryResults) {
    sessionFilePaths.push(...result.filePaths);
  }

  const sessionResults = await mapWithConcurrency(
    sessionFilePaths,
    SESSION_SUMMARY_READ_CONCURRENCY,
    readSessionSummary,
  );
  const sessions = sessionResults
    .map((result) => result.summary)
    .filter((session): session is SessionSummary => session !== null);
  partialFailure ||= sessionResults.some((result) => result.failed);
  sessions.sort((left, right) => right.modified.getTime() - left.modified.getTime());
  return { sessions, partialFailure };
}
