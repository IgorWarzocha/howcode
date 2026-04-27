import { emitDesktopEvent } from "../runtime/desktop-events.cts";
import { syncSessionSummaries } from "../thread-state-db.cts";
import { listAllSessionsStrict, mapSessionSummaryToRecord } from "./session-index.cts";

const syncedShellIndexes = new Set<string>();
const inFlightShellIndexSyncs = new Map<string, Promise<boolean>>();

type ShellIndexSyncResult = {
  complete: boolean;
  didSync: boolean;
};

async function syncShellIndex(cwd: string): Promise<ShellIndexSyncResult> {
  const { sessions, partialFailure } = await listAllSessionsStrict();

  syncSessionSummaries(
    cwd,
    sessions.map((session) => mapSessionSummaryToRecord(cwd, session)),
  );

  return { complete: !partialFailure, didSync: true };
}

function startShellIndexSync(
  cwd: string,
  options: { emitRefreshEvent?: boolean; warningLabel: string },
) {
  const syncPromise = syncShellIndex(cwd)
    .then((syncResult) => {
      if (syncResult.complete) {
        syncedShellIndexes.add(cwd);
      }

      if (syncResult.didSync && (options.emitRefreshEvent ?? true)) {
        emitDesktopEvent({ type: "shell-state-refresh" });
      }

      return syncResult.complete;
    })
    .catch((error) => {
      console.warn(options.warningLabel, error);
      return false;
    })
    .finally(() => {
      inFlightShellIndexSyncs.delete(cwd);
    });

  inFlightShellIndexSyncs.set(cwd, syncPromise);
  return syncPromise;
}

export function scheduleShellIndexSync(cwd: string) {
  if (syncedShellIndexes.has(cwd) || inFlightShellIndexSyncs.has(cwd)) {
    return;
  }

  void startShellIndexSync(cwd, { warningLabel: "Failed to sync shell index." });
}

export async function refreshShellIndex(
  cwd: string,
  options: { emitRefreshEvent?: boolean; force?: boolean } = {},
) {
  const inFlightSync = inFlightShellIndexSyncs.get(cwd);
  if (inFlightSync && !options.force) {
    return await inFlightSync;
  }

  if (inFlightSync) {
    // User-triggered project import needs a fresh filesystem pass. The background
    // startup sync may have snapshotted sessions before a Pi CLI project was created.
    await inFlightSync;

    const forcedInFlightSync = inFlightShellIndexSyncs.get(cwd);
    if (forcedInFlightSync) {
      return await forcedInFlightSync;
    }
  }

  return await startShellIndexSync(cwd, {
    emitRefreshEvent: options.emitRefreshEvent,
    warningLabel: "Failed to refresh shell index.",
  });
}
