import { describe, expect, it } from "vitest";
import { mockProjects } from "../data/mock-data";
import {
  createInitialWorkspaceState,
  getCurrentTitle,
  getProjectName,
  selectProject,
  selectThread,
  workspaceReducer,
} from "./workspace";

describe("workspace state", () => {
  it("creates initial state and hydrates collapse state from synced projects", () => {
    const initialState = createInitialWorkspaceState(mockProjects);
    expect(initialState.selectedProjectId).toBe("pi-plugin-codex");
    expect(initialState.selectedThreadId).toBeNull();
    expect(initialState.collapsedProjectIds["claw-phone"]).toBe(true);

    const syncedState = workspaceReducer(createInitialWorkspaceState([]), {
      type: "sync-projects",
      projects: [
        { id: "alpha", name: "alpha", collapsed: false, threads: [] },
        { id: "beta", name: "beta", collapsed: true, threads: [] },
      ],
    });
    expect(syncedState.selectedProjectId).toBe("alpha");
    expect(syncedState.collapsedProjectIds).toMatchObject({ alpha: false, beta: true });
  });

  it("keeps an open thread visible when refreshed projects still contain it", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "thread",
        selectedProjectId: "stale-project",
        selectedThreadId: "thread-1",
        selectedSessionPath: "/tmp/thread-1.jsonl",
      },
      {
        type: "sync-projects",
        projects: [
          {
            id: "alpha",
            name: "alpha",
            collapsed: false,
            threads: [
              { id: "thread-1", title: "Thread", age: "now", sessionPath: "/tmp/thread-1.jsonl" },
            ],
          },
        ],
      },
    );

    expect(nextState.activeView).toBe("thread");
    expect(nextState.selectedProjectId).toBe("alpha");
    expect(nextState.selectedThreadId).toBe("thread-1");
    expect(nextState.selectedSessionPath).toBe("/tmp/thread-1.jsonl");
  });

  it("falls back to the first project when an open thread genuinely disappears", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "thread",
        selectedProjectId: "missing-project",
        selectedThreadId: "missing-thread",
        selectedSessionPath: "/tmp/missing-thread.jsonl",
      },
      {
        type: "sync-projects",
        projects: [{ id: "alpha", name: "alpha", collapsed: false, threads: [] }],
      },
    );

    expect(nextState.activeView).toBe("code");
    expect(nextState.selectedProjectId).toBe("alpha");
    expect(nextState.selectedThreadId).toBeNull();
    expect(nextState.selectedSessionPath).toBeNull();
  });

  it("falls back to the first project when a non-thread selection disappears", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "code",
        selectedProjectId: "missing-project",
        selectedThreadId: null,
        selectedSessionPath: null,
      },
      {
        type: "sync-projects",
        projects: [{ id: "alpha", name: "alpha", collapsed: false, threads: [] }],
      },
    );

    expect(nextState.activeView).toBe("code");
    expect(nextState.selectedProjectId).toBe("alpha");
  });

  it("opens threads, expands projects, and restores terminal visibility across session changes", () => {
    const openedThread = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "/tmp/thread-a.jsonl",
    });
    expect(openedThread.activeView).toBe("thread");
    expect(openedThread.selectedProjectId).toBe("claw-phone");
    expect(openedThread.collapsedProjectIds["claw-phone"]).toBe(false);
    expect(openedThread.terminalVisible).toBe(false);

    const withVisibleTerminal = workspaceReducer(openedThread, {
      type: "set-terminal-visible",
      visible: true,
    });
    const otherThread = workspaceReducer(withVisibleTerminal, {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-b",
      sessionPath: "/tmp/thread-b.jsonl",
    });
    const backToFirstThread = workspaceReducer(otherThread, {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "/tmp/thread-a.jsonl",
    });
    expect(backToFirstThread.terminalVisible).toBe(true);

    const draftThread = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "local:/claw-phone/draft",
    });
    const visibleDraftThread = workspaceReducer(draftThread, {
      type: "set-terminal-visible",
      visible: true,
    });
    const persistedThread = workspaceReducer(visibleDraftThread, {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "/tmp/thread-a.jsonl",
    });
    expect(persistedThread.terminalVisible).toBe(true);
    expect(persistedThread.terminalVisibleBySession["/tmp/thread-a.jsonl"]).toBe(true);
  });

  it("preserves non-code views when selecting another project", () => {
    const extensionsState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "extensions",
        selectedProjectId: "pi-plugin-codex",
      },
      { type: "set-selected-project", projectId: "claw-phone" },
    );
    expect(extensionsState.activeView).toBe("extensions");
    expect(extensionsState.selectedProjectId).toBe("claw-phone");

    const skillsState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "skills",
        selectedProjectId: "pi-plugin-codex",
      },
      { type: "set-selected-project", projectId: "claw-phone" },
    );
    expect(skillsState.activeView).toBe("skills");
    expect(skillsState.selectedProjectId).toBe("claw-phone");
  });

  it("handles git ops entry, utility detours, and terminal restoration", () => {
    const gitOpsState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "thread",
        terminalVisible: true,
        selectedThreadId: "thread-1",
        selectedSessionPath: "/tmp/thread.jsonl",
      },
      {
        type: "open-gitops",
        filePath: "src/app/AppShell.tsx",
      },
    );
    expect(gitOpsState.activeView).toBe("gitops");
    expect(gitOpsState.selectedDiffFilePath).toBe("src/app/AppShell.tsx");
    expect(gitOpsState.terminalVisible).toBe(false);
    expect(gitOpsState.restoreTerminalVisibleOnGitOpsClose).toBe(true);

    const restoredFromClose = workspaceReducer(gitOpsState, { type: "close-gitops" });
    expect(restoredFromClose.activeView).toBe("thread");
    expect(restoredFromClose.terminalVisible).toBe(true);

    const restoredFromShowView = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "gitops",
        terminalVisible: false,
        restoreTerminalVisibleOnGitOpsClose: true,
      },
      { type: "show-view", view: "thread" },
    );
    expect(restoredFromShowView.terminalVisible).toBe(true);

    const utilityDetour = workspaceReducer(gitOpsState, {
      type: "show-view",
      view: "extensions",
    });
    const restoredGitOps = workspaceReducer(utilityDetour, { type: "close-utility-view" });
    expect(restoredGitOps.activeView).toBe("gitops");
    expect(restoredGitOps.selectedDiffFilePath).toBe("src/app/AppShell.tsx");
  });

  it("restores thread context after utility views and keeps the original return target", () => {
    const threadState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-1",
      sessionPath: "/tmp/thread.jsonl",
    });
    const settingsState = workspaceReducer(threadState, {
      type: "show-view",
      view: "settings",
    });
    const skillsState = workspaceReducer(settingsState, {
      type: "show-view",
      view: "skills",
    });
    const restoredState = workspaceReducer(skillsState, {
      type: "close-utility-view",
    });

    expect(settingsState.utilityViewReturnState?.activeView).toBe("thread");
    expect(restoredState.activeView).toBe("thread");
    expect(restoredState.selectedProjectId).toBe("claw-phone");
    expect(restoredState.selectedThreadId).toBe("thread-1");
    expect(restoredState.selectedSessionPath).toBe("/tmp/thread.jsonl");
  });

  it("clears thread-only state when leaving thread view and treats archived as a main view", () => {
    const codeState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "thread",
        selectedThreadId: "thread-1",
        selectedSessionPath: "/tmp/thread.jsonl",
        selectedDiffFilePath: "src/app.ts",
      },
      {
        type: "show-view",
        view: "code",
      },
    );
    expect(codeState.activeView).toBe("code");
    expect(codeState.selectedThreadId).toBeNull();
    expect(codeState.selectedSessionPath).toBeNull();
    expect(codeState.selectedDiffFilePath).toBeNull();

    const archivedState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        settingsOpen: true,
      },
      { type: "show-view", view: "archived" },
    );
    expect(archivedState.activeView).toBe("archived");
    expect(archivedState.settingsOpen).toBe(false);
  });

  it("handles project collapse plus takeover visibility and override migration", () => {
    const toggledState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "toggle-project-collapse",
      projectId: "pi-plugin-codex",
    });
    const collapsedState = workspaceReducer(toggledState, {
      type: "collapse-all-projects",
    });
    expect(toggledState.collapsedProjectIds["pi-plugin-codex"]).toBe(false);
    expect(Object.values(collapsedState.collapsedProjectIds).every(Boolean)).toBe(true);

    const takeoverState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "show-takeover",
    });
    expect(takeoverState.takeoverVisible).toBe(true);
    const hiddenTakeover = workspaceReducer(takeoverState, { type: "hide-takeover" });
    expect(hiddenTakeover.takeoverVisible).toBe(false);

    const withOverride = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "set-session-takeover-override",
      sessionPath: "/tmp/thread.jsonl",
      visible: true,
    });
    expect(withOverride.takeoverOverrides["/tmp/thread.jsonl"]).toBe(true);

    const migratedOverride = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "thread",
        selectedProjectId: "pi-plugin-codex",
        selectedThreadId: "thread-1",
        selectedSessionPath: "local://%2Frepo/draft",
        takeoverOverrides: {
          "local://%2Frepo/draft": false,
        },
      },
      {
        type: "open-thread",
        projectId: "pi-plugin-codex",
        threadId: "thread-1",
        sessionPath: "/repo/.pi/thread-1.json",
      },
    );
    expect(migratedOverride.takeoverOverrides["local://%2Frepo/draft"]).toBeUndefined();
    expect(migratedOverride.takeoverOverrides["/repo/.pi/thread-1.json"]).toBe(false);
  });

  it("resolves fallback project and thread titles safely", () => {
    const project = selectProject(mockProjects, "missing-project");
    const thread = selectThread(project, "missing-thread");

    expect(getProjectName(project)).toBe("pi-plugin-codex");
    expect(thread).toBeUndefined();
    expect(getCurrentTitle("thread", thread)).toBe("New thread");
    expect(getCurrentTitle("gitops", thread)).toBe("Git ops");
    expect(getCurrentTitle("archived", thread)).toBe("Archived threads");
    expect(getCurrentTitle("code", thread)).toBe("New thread");
  });
});
