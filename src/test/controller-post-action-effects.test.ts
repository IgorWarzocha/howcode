import { describe, expect, it } from "vitest";
import {
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedShellState,
} from "../app/app-shell/controller-post-action-effects";
import { defaultPiSettings } from "../../shared/default-pi-settings";
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
      composerStreamingBehavior: "followUp",
      dictationModelId: null,
      dictationMaxDurationSeconds: 180,
      showDictationButton: true,
      favoriteFolders: ["/existing"],
      projectImportState: null,
      preferredProjectLocation: null,
      initializeGitOnProjectCreate: false,
      projectDeletionMode: "pi-only",
      useAgentsSkillsPaths: false,
      piTuiTakeover: false,
    },
    piSettings: defaultPiSettings,
    availableHosts: [],
    composer: {
      currentModel: null,
      availableModels: [],
      currentThinkingLevel: "medium",
      availableThinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh"],
      queuedPrompts: [],
      contextUsage: null,
      isCompacting: false,
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
  it("applies representative optimistic setting updates", () => {
    const state = buildShellState();

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "gitCommitMessageModel",
        provider: "openai",
        modelId: "gpt-5",
      }),
    ).toMatchObject({
      appSettings: { gitCommitMessageModel: { provider: "openai", id: "gpt-5" } },
    });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "skillCreatorModel",
        provider: "anthropic",
        modelId: "claude-sonnet",
      }),
    ).toMatchObject({
      appSettings: { skillCreatorModel: { provider: "anthropic", id: "claude-sonnet" } },
    });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "favoriteFolders",
        folders: [" /repo ", "/repo", "", "/existing"],
      }),
    ).toMatchObject({ appSettings: { favoriteFolders: ["/repo", "/existing"] } });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "projectDeletionMode",
        value: "full-clean",
      }),
    ).toMatchObject({ appSettings: { projectDeletionMode: "full-clean" } });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "showDictationButton",
        value: false,
      }),
    ).toMatchObject({ appSettings: { showDictationButton: false } });
  });

  it("resets model selections and normalizes blank project locations", () => {
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
    ).toMatchObject({ appSettings: { gitCommitMessageModel: null } });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "skillCreatorModel",
        reset: true,
      }),
    ).toMatchObject({ appSettings: { skillCreatorModel: null } });

    expect(
      getOptimisticallyUpdatedShellState(state, {
        key: "preferredProjectLocation",
        value: "   ",
      }),
    ).toMatchObject({ appSettings: { preferredProjectLocation: null } });
  });

  it("renames projects and ignores invalid rename payloads", () => {
    const state = buildShellState();
    const result = getOptimisticallyRenamedShellState(state, {
      projectId: "/repo",
      projectName: "Renamed repo",
    });
    expect(result?.projects[0]).toMatchObject({ id: "/repo", name: "Renamed repo" });

    expect(
      getOptimisticallyRenamedShellState(state, {
        projectId: "/repo",
        projectName: "   ",
      }),
    ).toBe(state);
  });

  it("pins threads and projects while ignoring invalid pin payloads", () => {
    const state = buildShellState();

    expect(
      getOptimisticallyPinnedShellState(state, "thread.pin", {
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

    expect(
      getOptimisticallyPinnedShellState(state, "project.pin", {
        projectId: "/another",
      }),
    ).toMatchObject({
      projects: [
        { id: "/another", pinned: true },
        { id: "/repo", pinned: false },
      ],
    });

    expect(getOptimisticallyPinnedShellState(state, "thread.pin", { projectId: "/another" })).toBe(
      state,
    );
    expect(getOptimisticallyPinnedShellState(state, "project.pin", {})).toBe(state);
    expect(getOptimisticallyPinnedShellState(state, "thread.open", { projectId: "/another" })).toBe(
      state,
    );
  });
});
