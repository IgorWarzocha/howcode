import type { PiRuntime } from "../runtime/types.cts";

export async function prepareTurnDiffCapture(runtime: PiRuntime) {
  runtime.pendingTurnCount = null;
  return true;
}

export async function captureCompletedTurnDiff(runtime: PiRuntime) {
  runtime.pendingTurnCount = null;
  void runtime;
  return null;
}
