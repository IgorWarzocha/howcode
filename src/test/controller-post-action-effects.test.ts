import { describe, expect, it } from "vitest";
import { getOptimisticallyUpdatedShellState } from "../app/app-shell/controller-post-action-effects";
import type { ShellState } from "../app/desktop/types";

function buildShellState(): ShellState {
  return {
    platform: "linux",
    mockMode: false,
    productName: "Pi",
    cwd: "/repo",
    agentDir: "/repo/.pi",
    sessionDir: "/repo/.pi/sessions",
    appSettings: {
      gitCommitMessageModel: null,
      favoriteFolders: ["/existing"],
      projectImportState: null,
    },
    availableHosts: [],
    composer: {
      currentModel: null,
      availableModels: [],
      currentThinkingLevel: "medium",
      availableThinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh"],
    },
    projects: [],
  };
}

describe("controller post action effects", () => {
  it("updates the optimistic git commit model selection", () => {
    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "gitCommitMessageModel",
        provider: "openai",
        modelId: "gpt-5",
      }),
    ).toMatchObject({
      appSettings: {
        gitCommitMessageModel: { provider: "openai", id: "gpt-5" },
      },
    });
  });

  it("deduplicates favorite folders during optimistic updates", () => {
    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "favoriteFolders",
        folders: [" /repo ", "/repo", "", "/existing"],
      }),
    ).toMatchObject({
      appSettings: {
        favoriteFolders: ["/repo", "/existing"],
      },
    });
  });
});
