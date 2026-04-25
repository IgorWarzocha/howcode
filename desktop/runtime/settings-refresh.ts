import path from "node:path";
import { getPersistedSessionPath } from "../../shared/session-paths";
import type { ComposerState } from "../../shared/desktop-contracts";
import type { PiRuntime } from "./types.cts";

export type RuntimeRecordSnapshot = {
  runtimeKey: string;
  runtimePromise: Promise<PiRuntime>;
};

type RuntimeSettingsRefreshControllerOptions = {
  getCachedRuntimeForSessionPath: (sessionPath: string) => Promise<PiRuntime> | null;
  getRuntimeRecords: () => RuntimeRecordSnapshot[];
  withRuntimeMutationLock: <T>(runtimeKey: string, task: () => Promise<T>) => Promise<T>;
  buildComposerState: (runtime: PiRuntime) => Promise<ComposerState>;
  publishComposerUpdate: (
    composer: ComposerState,
    selection: { projectId: string | null; sessionPath: string | null },
  ) => void;
};

export function isRuntimeBusy(runtime: PiRuntime) {
  return runtime.session.isStreaming || runtime.session.isCompacting;
}

export function createRuntimeSettingsRefreshController({
  getCachedRuntimeForSessionPath,
  getRuntimeRecords,
  withRuntimeMutationLock,
  buildComposerState,
  publishComposerUpdate,
}: RuntimeSettingsRefreshControllerOptions) {
  const staleGenerations = new Map<string, number>();
  const activeReloads = new Map<string, Promise<void>>();

  async function reloadRuntimeSettings(runtimeKey: string, runtime: PiRuntime) {
    if (isRuntimeBusy(runtime)) {
      return false;
    }

    const existingReload = activeReloads.get(runtimeKey);
    if (existingReload) {
      await existingReload;
      return false;
    }

    const reload = runtime.session.reload().finally(() => {
      if (activeReloads.get(runtimeKey) === reload) {
        activeReloads.delete(runtimeKey);
      }
    });

    activeReloads.set(runtimeKey, reload);
    await reload;
    return true;
  }

  async function reloadIfSafe(
    sessionPath: string,
    options: { useMutationLock?: boolean } = {},
  ): Promise<boolean> {
    const runtimeKey = getPersistedSessionPath(sessionPath);
    if (!runtimeKey || !staleGenerations.has(runtimeKey)) {
      return false;
    }

    if (options.useMutationLock ?? true) {
      return await withRuntimeMutationLock(runtimeKey, () =>
        reloadIfSafe(runtimeKey, { useMutationLock: false }),
      );
    }

    const runtimePromise = getCachedRuntimeForSessionPath(runtimeKey);
    if (!runtimePromise) {
      staleGenerations.delete(runtimeKey);
      return false;
    }

    const runtime = await runtimePromise;
    try {
      let reloaded = false;
      let reloadedGeneration: number | null = null;
      while (!isRuntimeBusy(runtime)) {
        const generation = staleGenerations.get(runtimeKey);
        if (generation === undefined) {
          break;
        }

        const didReload = await reloadRuntimeSettings(runtimeKey, runtime);
        if (!didReload) {
          break;
        }

        reloaded = true;
        reloadedGeneration = generation;
        if (staleGenerations.get(runtimeKey) === generation) {
          break;
        }
      }

      if (reloaded) {
        const composer = await buildComposerState(runtime);
        publishComposerUpdate(composer, {
          projectId: runtime.cwd,
          sessionPath: runtime.session.sessionFile ?? null,
        });
        if (
          reloadedGeneration !== null &&
          staleGenerations.get(runtimeKey) === reloadedGeneration
        ) {
          staleGenerations.delete(runtimeKey);
        }
      }
      return reloaded;
    } catch {
      // Keep the stale mark; the next safe point retries silently.
      return false;
    }
  }

  function markStale(sessionPath: string | null | undefined) {
    const runtimeKey = getPersistedSessionPath(sessionPath ?? null);
    if (!runtimeKey) {
      return;
    }

    staleGenerations.set(runtimeKey, (staleGenerations.get(runtimeKey) ?? 0) + 1);
    void reloadIfSafe(runtimeKey).catch(() => undefined);
  }

  function markStaleForProject(projectPath?: string | null) {
    if (projectPath !== null && projectPath !== undefined && projectPath.trim().length === 0) {
      return;
    }

    const normalizedProjectPath = projectPath ? path.resolve(projectPath) : "";
    for (const { runtimeKey, runtimePromise } of getRuntimeRecords()) {
      void runtimePromise
        .then((runtime) => {
          if (normalizedProjectPath && path.resolve(runtime.cwd) !== normalizedProjectPath) {
            return;
          }

          staleGenerations.set(runtimeKey, (staleGenerations.get(runtimeKey) ?? 0) + 1);
          void reloadIfSafe(runtimeKey).catch(() => undefined);
        })
        .catch(() => undefined);
    }
  }

  function isStale(sessionPath: string | null | undefined) {
    const runtimeKey = getPersistedSessionPath(sessionPath ?? null);
    return Boolean(runtimeKey && staleGenerations.has(runtimeKey));
  }

  return { isStale, markStale, markStaleForProject, reloadIfSafe };
}
