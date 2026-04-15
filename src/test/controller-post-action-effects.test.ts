import { describe, expect, it } from "vitest";
import {
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedShellState,
} from "../app/app-shell/controller-post-action-effects";
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
      skillCreatorModel: null,
      favoriteFolders: ["/existing"],
      projectImportState: null,
      preferredProjectLocation: null,
      initializeGitOnProjectCreate: false,
      projectDeletionMode: "pi-only",
      useAgentsSkillsPaths: false,
      piTuiTakeover: false,
    },
    availableHosts: [],
    composer: {
      currentModel: null,
      availableModels: [],
      currentThinkingLevel: "medium",
      availableThinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh"],
    },
    projects: [
      {
        id: "/repo",
        name: "Repo",
        pinned: false,
        threads: [],
        collapsed: false,
        threadsLoaded: true,
        threadCount: 0,
        repoOriginChecked: false,
        repoOriginUrl: null,
      },
      {
        id: "/another",
        name: "Another",
        pinned: false,
        threads: [
          {
            id: "thread-1",
            title: "First",
            age: "1m",
            pinned: false,
            sessionPath: "/another/1",
          },
          {
            id: "thread-2",
            title: "Second",
            age: "2m",
            pinned: true,
            sessionPath: "/another/2",
          },
        ],
        collapsed: false,
        threadsLoaded: true,
        threadCount: 2,
        repoOriginChecked: false,
        repoOriginUrl: null,
      },
    ],
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

  it("updates the optimistic skill creator model selection", () => {
    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "skillCreatorModel",
        provider: "anthropic",
        modelId: "claude-sonnet",
      }),
    ).toMatchObject({
      appSettings: {
        skillCreatorModel: { provider: "anthropic", id: "claude-sonnet" },
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

  it("updates project creation settings optimistically", () => {
    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "preferredProjectLocation",
        value: "/work",
      }),
    ).toMatchObject({
      appSettings: {
        preferredProjectLocation: "/work",
      },
    });

    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "initializeGitOnProjectCreate",
        value: true,
      }),
    ).toMatchObject({
      appSettings: {
        initializeGitOnProjectCreate: true,
      },
    });

    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "useAgentsSkillsPaths",
        value: true,
      }),
    ).toMatchObject({
      appSettings: {
        useAgentsSkillsPaths: true,
      },
    });

    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "projectDeletionMode",
        value: "full-clean",
      }),
    ).toMatchObject({
      appSettings: {
        projectDeletionMode: "full-clean",
      },
    });

    expect(
      getOptimisticallyUpdatedShellState(buildShellState(), {
        key: "piTuiTakeover",
        value: true,
      }),
    ).toMatchObject({
      appSettings: {
        piTuiTakeover: true,
      },
    });
  });

  it("resets model selections and trims blank project locations", () => {
    const state = {
      ...buildShellState(),
      appSettings: {
        ...buildShellState().appSettings,
        gitCommitMessageModel: { provider: "openai", id: "gpt-5" },
        skillCreatorModel: { provider: "anthropic", id: "claude" },
        preferredProjectLocation: "/tmp/work",
      },
    } satisfies ShellState;

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "gitCommitMessageModel",
        reset: true,
      }),
    ).toMatchObject({
      appSettings: {
        gitCommitMessageModel: null,
      },
    });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "skillCreatorModel",
        reset: true,
      }),
    ).toMatchObject({
      appSettings: {
        skillCreatorModel: null,
      },
    });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "preferredProjectLocation",
        value: "   ",
      }),
    ).toMatchObject({
      appSettings: {
        preferredProjectLocation: null,
      },
    });
  });

  it("renames projects optimistically", () => {
    const result = getOptimisticallyRenamedShellState(buildShellState(), {
      projectId: "/repo",
      projectName: "Renamed repo",
    });

    expect(result?.projects[0]).toMatchObject({
      id: "/repo",
      name: "Renamed repo",
    });
  });

  it("leaves state unchanged for invalid rename and pin payloads", () => {
    const state = buildShellState();

    expect(
      getOptimisticallyRenamedShellState(state, {
        projectId: "/repo",
        projectName: "   ",
      }),
    ).toBe(state);

    expect(getOptimisticallyPinnedShellState(state, "thread.pin", { projectId: "/another" })).toBe(
      state,
    );
    expect(getOptimisticallyPinnedShellState(state, "project.pin", {})).toBe(state);
    expect(getOptimisticallyPinnedShellState(state, "thread.open", { projectId: "/another" })).toBe(
      state,
    );
  });

  it("pins threads optimistically and moves them to the front", () => {
    expect(
      getOptimisticallyPinnedShellState(buildShellState(), "thread.pin", {
        projectId: "/another",
        threadId: "thread-1",
      }),
    ).toMatchObject({
      projects: [
        { id: "/repo" },
        {
          id: "/another",
          threads: [
            { id: "thread-1", pinned: true },
            { id: "thread-2", pinned: true },
          ],
        },
      ],
    });
  });

  it("pins projects optimistically and moves them to the front", () => {
    expect(
      getOptimisticallyPinnedShellState(buildShellState(), "project.pin", {
        projectId: "/another",
      }),
    ).toMatchObject({
      projects: [
        { id: "/another", pinned: true },
        { id: "/repo", pinned: false },
      ],
    });
  });
});
