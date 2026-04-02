import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { TurnDiffResult } from "../../shared/desktop-contracts";
import { mapAgentMessagesToUiMessages } from "../../shared/pi-message-mapper";
import type { PiRuntime } from "../runtime/types";
import {
  getLatestTurnDiffSummary,
  getThreadCwd,
  listTurnDiffSummaries,
  upsertTurnDiffSummary,
} from "../thread-state-db";
import {
  captureCheckpoint,
  checkpointRefForSessionTurn,
  diffCheckpoints,
  hasCheckpointRef,
  isGitRepository,
} from "./checkpoint-store";
import { parseTurnDiffFilesFromUnifiedDiff } from "./summary-parser";

function getLatestAssistantMessageId(runtime: PiRuntime) {
  const messages = mapAgentMessagesToUiMessages(runtime.session.messages as AgentMessage[]);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message.id;
    }
  }

  return undefined;
}

export function getTurnDiffSummaries(sessionPath: string) {
  return listTurnDiffSummaries(sessionPath);
}

export async function prepareTurnDiffCapture(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) {
    runtime.pendingTurnCount = null;
    return false;
  }

  if (!(await isGitRepository(runtime.cwd))) {
    runtime.pendingTurnCount = null;
    return false;
  }

  const currentTurnCount = getLatestTurnDiffSummary(sessionPath)?.checkpointTurnCount ?? 0;
  const baselineCheckpointRef = checkpointRefForSessionTurn(sessionPath, currentTurnCount);

  if (!(await hasCheckpointRef(runtime.cwd, baselineCheckpointRef))) {
    await captureCheckpoint({
      cwd: runtime.cwd,
      checkpointRef: baselineCheckpointRef,
    });
  }

  runtime.pendingTurnCount = currentTurnCount + 1;
  return true;
}

export async function captureCompletedTurnDiff(runtime: PiRuntime) {
  const sessionPath = runtime.session.sessionFile;
  const turnCount = runtime.pendingTurnCount;

  runtime.pendingTurnCount = null;

  if (!sessionPath || turnCount === null) {
    return null;
  }

  if (!(await isGitRepository(runtime.cwd))) {
    return null;
  }

  const fromCheckpointRef = checkpointRefForSessionTurn(sessionPath, Math.max(0, turnCount - 1));
  const toCheckpointRef = checkpointRefForSessionTurn(sessionPath, turnCount);

  await captureCheckpoint({ cwd: runtime.cwd, checkpointRef: toCheckpointRef });
  const diff = await diffCheckpoints({
    cwd: runtime.cwd,
    fromCheckpointRef,
    toCheckpointRef,
  });
  const completedAt = new Date().toISOString();

  upsertTurnDiffSummary({
    sessionPath,
    checkpointTurnCount: turnCount,
    checkpointRef: toCheckpointRef,
    status: "ready",
    files: parseTurnDiffFilesFromUnifiedDiff(diff),
    assistantMessageId: getLatestAssistantMessageId(runtime),
    completedAt,
  });

  return {
    sessionPath,
    fromTurnCount: Math.max(0, turnCount - 1),
    toTurnCount: turnCount,
    diff,
  } satisfies TurnDiffResult;
}

export async function getTurnDiff(
  sessionPath: string,
  checkpointTurnCount: number,
): Promise<TurnDiffResult | null> {
  const summary = listTurnDiffSummaries(sessionPath).find(
    (entry) => entry.checkpointTurnCount === checkpointTurnCount,
  );
  const cwd = getThreadCwd(sessionPath);

  if (!summary || !cwd) {
    return null;
  }

  return {
    sessionPath,
    fromTurnCount: Math.max(0, checkpointTurnCount - 1),
    toTurnCount: checkpointTurnCount,
    diff: await diffCheckpoints({
      cwd,
      fromCheckpointRef: checkpointRefForSessionTurn(
        sessionPath,
        Math.max(0, checkpointTurnCount - 1),
      ),
      toCheckpointRef: summary.checkpointRef,
    }),
  };
}

export async function getFullThreadDiff(sessionPath: string): Promise<TurnDiffResult | null> {
  const latestSummary = getLatestTurnDiffSummary(sessionPath);
  const cwd = getThreadCwd(sessionPath);

  if (!latestSummary || !cwd) {
    return null;
  }

  return {
    sessionPath,
    fromTurnCount: 0,
    toTurnCount: latestSummary.checkpointTurnCount,
    diff: await diffCheckpoints({
      cwd,
      fromCheckpointRef: checkpointRefForSessionTurn(sessionPath, 0),
      toCheckpointRef: latestSummary.checkpointRef,
    }),
  };
}
