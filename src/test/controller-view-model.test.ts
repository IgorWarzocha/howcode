import { describe, expect, it } from "vitest";
import { deriveControllerViewModel } from "../app/app-shell/controller-view-model";

describe("deriveControllerViewModel", () => {
  it("builds fallback active thread data and current title for thread view", () => {
    const result = deriveControllerViewModel({
      projects: [
        {
          id: "/repo",
          name: "Repo",
          collapsed: false,
          threadsLoaded: true,
          threadCount: 1,
          threads: [
            {
              id: "thread-1",
              title: "Fix timeline",
              age: "now",
              sessionPath: "/repo/session.json",
            },
          ],
        },
      ],
      workspaceState: {
        activeView: "thread",
        selectedProjectId: "/repo",
        selectedInboxSessionPath: null,
        selectedThreadId: "thread-1",
        selectedSessionPath: "/repo/session.json",
        terminalVisible: false,
        takeoverVisible: false,
        takeoverOverrides: {},
        gitOpsReturnView: "code",
        selectedDiffTurnCount: null,
        selectedDiffFilePath: null,
        settingsOpen: false,
        settingsPanelOpen: false,
        archivedThreadsOpen: false,
        collapsedProjectIds: {},
      },
      threadData: null,
      shellCwd: "/fallback",
      composerState: null,
      shellComposerState: null,
    });

    expect(result.currentTitle).toBe("Fix timeline");
    expect(result.composerProjectId).toBe("/repo");
    expect(result.activeThreadData).toEqual({
      sessionPath: "/repo/session.json",
      title: "Fix timeline",
      messages: [],
      previousMessageCount: 0,
      isStreaming: false,
      turnDiffSummaries: [],
    });
  });
});
