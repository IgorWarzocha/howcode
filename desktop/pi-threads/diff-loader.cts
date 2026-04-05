import type { TurnDiffResult } from "../../shared/desktop-contracts.ts";
import { getFullThreadDiff, getTurnDiff } from "../diff/query.cts";

export async function loadTurnDiff(
  sessionPath: string,
  checkpointTurnCount: number,
): Promise<TurnDiffResult | null> {
  return getTurnDiff(sessionPath, checkpointTurnCount);
}

export async function loadFullThreadDiff(sessionPath: string): Promise<TurnDiffResult | null> {
  return getFullThreadDiff(sessionPath);
}
