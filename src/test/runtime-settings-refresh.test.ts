import { describe, expect, it, vi } from "vitest";
import { createRuntimeSettingsRefreshController } from "../../desktop/runtime/settings-refresh";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createRuntime(reload: () => Promise<void> = async () => undefined) {
  return {
    cwd: "/repo",
    session: {
      isStreaming: false,
      isCompacting: false,
      sessionFile: "/repo/.pi/session.jsonl",
      reload,
    },
  } as never;
}

describe("runtime settings refresh", () => {
  it("publishes composer state after a safe stale reload", async () => {
    const runtime = createRuntime();
    const publishComposerUpdate = vi.fn();
    const controller = createRuntimeSettingsRefreshController({
      getCachedRuntimeForSessionPath: () => Promise.resolve(runtime),
      getRuntimeRecords: () => [],
      withRuntimeMutationLock: async <T>(_runtimeKey: string, task: () => Promise<T>) => task(),
      buildComposerState: async () => ({
        currentModel: null,
        availableModels: [],
        currentThinkingLevel: "medium",
        availableThinkingLevels: ["medium"],
        queuedPrompts: [],
      }),
      publishComposerUpdate,
    });

    controller.markStale("/repo/.pi/session.jsonl");
    await vi.waitFor(() => expect(publishComposerUpdate).toHaveBeenCalledTimes(1));
    expect(controller.isStale("/repo/.pi/session.jsonl")).toBe(false);
  });

  it("runs another reload when a newer stale generation arrives during reload", async () => {
    const firstReload = deferred();
    const reload = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstReload.promise)
      .mockResolvedValueOnce(undefined);
    const runtime = createRuntime(reload);
    const controller = createRuntimeSettingsRefreshController({
      getCachedRuntimeForSessionPath: () => Promise.resolve(runtime),
      getRuntimeRecords: () => [],
      withRuntimeMutationLock: async <T>(_runtimeKey: string, task: () => Promise<T>) => task(),
      buildComposerState: async () => ({
        currentModel: null,
        availableModels: [],
        currentThinkingLevel: "medium",
        availableThinkingLevels: ["medium"],
        queuedPrompts: [],
      }),
      publishComposerUpdate: vi.fn(),
    });

    controller.markStale("/repo/.pi/session.jsonl");
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    controller.markStale("/repo/.pi/session.jsonl");
    firstReload.resolve();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
    expect(controller.isStale("/repo/.pi/session.jsonl")).toBe(false);
  });
});
