import type { PiRuntime } from "../types.cts";

const RUNTIME_IDLE_TIMEOUT_MS = 15 * 60 * 1_000;
const LIVE_THREAD_UPDATE_THROTTLE_MS = 50;

export type RuntimeRecord = {
  runtimePromise: Promise<PiRuntime>;
  disposeTimeout: ReturnType<typeof setTimeout> | null;
  settingsCwd: string | null;
};

const runtimeRecords = new Map<string, RuntimeRecord>();
const runtimeMutationTails = new Map<string, Promise<void>>();
const liveThreadUpdateTimers = new WeakMap<PiRuntime, ReturnType<typeof setTimeout>>();

export function getRuntimeRecord(runtimeKey: string) {
  return runtimeRecords.get(runtimeKey) ?? null;
}

export function getRuntimeRecordSnapshots() {
  return [...runtimeRecords.entries()].map(([runtimeKey, record]) => ({
    runtimeKey,
    runtimePromise: record.runtimePromise,
    settingsCwd: record.settingsCwd,
  }));
}

export function registerRuntime(
  runtimeKey: string,
  runtimePromise: Promise<PiRuntime>,
  settingsCwd: string | null = null,
) {
  const record: RuntimeRecord = {
    runtimePromise,
    disposeTimeout: null,
    settingsCwd,
  };

  runtimeRecords.set(runtimeKey, record);
  return record;
}

export function deleteRuntimeRecordIfCurrent(runtimeKey: string, record: RuntimeRecord) {
  if (runtimeRecords.get(runtimeKey) === record) {
    runtimeRecords.delete(runtimeKey);
  }
}

function clearRuntimeDisposeTimeout(runtimeKey: string) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record?.disposeTimeout) {
    return;
  }

  clearTimeout(record.disposeTimeout);
  record.disposeTimeout = null;
}

export function suspendRuntimeDisposal(runtimeKey: string) {
  clearRuntimeDisposeTimeout(runtimeKey);
}

export function scheduleRuntimeDisposal(
  runtimeKey: string,
  isRuntimeBusy: (runtime: PiRuntime) => boolean,
) {
  const record = runtimeRecords.get(runtimeKey);
  if (!record) {
    return;
  }

  clearRuntimeDisposeTimeout(runtimeKey);

  record.disposeTimeout = setTimeout(() => {
    void (async () => {
      const currentRecord = runtimeRecords.get(runtimeKey);
      if (!currentRecord || currentRecord !== record) {
        return;
      }

      try {
        const runtime = await record.runtimePromise;
        if (isRuntimeBusy(runtime)) {
          scheduleRuntimeDisposal(runtimeKey, isRuntimeBusy);
          return;
        }

        runtime.session.dispose();
      } catch {
        // Ignore runtime disposal races after failed creation.
      } finally {
        deleteRuntimeRecordIfCurrent(runtimeKey, record);
      }
    })();
  }, RUNTIME_IDLE_TIMEOUT_MS);
}

export function cancelLiveThreadUpdate(runtime: PiRuntime) {
  const timer = liveThreadUpdateTimers.get(runtime);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  liveThreadUpdateTimers.delete(runtime);
}

export function deferLiveThreadUpdate(
  runtime: PiRuntime,
  publishLiveThreadUpdate: (runtime: PiRuntime) => void,
  options: { requireStreaming?: boolean } = {},
) {
  cancelLiveThreadUpdate(runtime);
  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (options.requireStreaming !== false && !runtime.session.isStreaming) {
      return;
    }

    publishLiveThreadUpdate(runtime);
  }, 0);

  liveThreadUpdateTimers.set(runtime, timer);
}

export function scheduleLiveThreadUpdate(
  runtime: PiRuntime,
  publishLiveThreadUpdate: (runtime: PiRuntime) => void,
) {
  if (liveThreadUpdateTimers.has(runtime)) {
    return;
  }

  const timer = setTimeout(() => {
    liveThreadUpdateTimers.delete(runtime);
    if (!runtime.session.isStreaming) {
      return;
    }

    publishLiveThreadUpdate(runtime);
  }, LIVE_THREAD_UPDATE_THROTTLE_MS);

  liveThreadUpdateTimers.set(runtime, timer);
}

export async function withRuntimeMutationLock<T>(runtimeKey: string, task: () => Promise<T>) {
  const previousTail = runtimeMutationTails.get(runtimeKey) ?? Promise.resolve();
  let releaseCurrentTail: (() => void) | undefined;
  const currentTail = new Promise<void>((resolve) => {
    releaseCurrentTail = resolve;
  });

  const nextTail = previousTail.then(() => currentTail);
  runtimeMutationTails.set(runtimeKey, nextTail);

  await previousTail;

  try {
    return await task();
  } finally {
    if (releaseCurrentTail) {
      releaseCurrentTail();
    }
    if (runtimeMutationTails.get(runtimeKey) === nextTail) {
      runtimeMutationTails.delete(runtimeKey);
    }
  }
}
