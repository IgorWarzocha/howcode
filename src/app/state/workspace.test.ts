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
  it("creates initial selection from the first project and thread", () => {
    const state = createInitialWorkspaceState(mockProjects);

    expect(state.selectedProjectId).toBe("pi-plugin-codex");
    expect(state.selectedThreadId).toBeNull();
    expect(state.collapsedProjectIds["claw-phone"]).toBe(true);
  });

  it("hydrates persisted project collapse state from shell projects", () => {
    const state = workspaceReducer(createInitialWorkspaceState([]), {
      type: "sync-projects",
      projects: [
        { id: "alpha", name: "alpha", collapsed: false, threads: [] },
        { id: "beta", name: "beta", collapsed: true, threads: [] },
      ],
    });

    expect(state.selectedProjectId).toBe("alpha");
    expect(state.collapsedProjectIds.alpha).toBe(false);
    expect(state.collapsedProjectIds.beta).toBe(true);
  });

  it("falls back to the first project if the selected project disappears", () => {
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

  it("opens a thread and forces its project expanded", () => {
    const state = createInitialWorkspaceState(mockProjects);
    const nextState = workspaceReducer(state, {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "missing-thread",
      sessionPath: "/tmp/missing-thread.jsonl",
    });

    expect(nextState.activeView).toBe("thread");
    expect(nextState.selectedProjectId).toBe("claw-phone");
    expect(nextState.selectedSessionPath).toBe("/tmp/missing-thread.jsonl");
    expect(nextState.terminalVisible).toBe(false);
    expect(nextState.collapsedProjectIds["claw-phone"]).toBe(false);
  });

  it("restores terminal visibility per thread session", () => {
    const openedThread = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "/tmp/thread-a.jsonl",
    });
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

    expect(withVisibleTerminal.terminalVisibleBySession["/tmp/thread-a.jsonl"]).toBe(true);
    expect(otherThread.terminalVisible).toBe(false);
    expect(backToFirstThread.terminalVisible).toBe(true);
  });

  it("preserves terminal visibility when a draft thread gets a persisted session path", () => {
    const draftThread = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "local:/claw-phone/draft",
    });
    const withVisibleTerminal = workspaceReducer(draftThread, {
      type: "set-terminal-visible",
      visible: true,
    });
    const persistedThread = workspaceReducer(withVisibleTerminal, {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "thread-a",
      sessionPath: "/tmp/thread-a.jsonl",
    });

    expect(persistedThread.terminalVisible).toBe(true);
    expect(persistedThread.terminalVisibleBySession["/tmp/thread-a.jsonl"]).toBe(true);
  });

  it("can change the selected project without leaving extensions", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "extensions",
        selectedProjectId: "pi-plugin-codex",
      },
      { type: "set-selected-project", projectId: "claw-phone" },
    );

    expect(nextState.activeView).toBe("extensions");
    expect(nextState.selectedProjectId).toBe("claw-phone");
  });

  it("can open git ops with a selected file", () => {
    const nextState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-gitops",
      filePath: "src/app/AppShell.tsx",
    });

    expect(nextState.activeView).toBe("gitops");
    expect(nextState.selectedDiffFilePath).toBe("src/app/AppShell.tsx");
  });

  it("hides the terminal while git ops is open and restores it on return", () => {
    const gitOpsState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "thread",
        terminalVisible: true,
      },
      {
        type: "open-gitops",
      },
    );
    const restoredState = workspaceReducer(gitOpsState, { type: "close-gitops" });

    expect(gitOpsState.activeView).toBe("gitops");
    expect(gitOpsState.terminalVisible).toBe(false);
    expect(gitOpsState.restoreTerminalVisibleOnGitOpsClose).toBe(true);
    expect(restoredState.activeView).toBe("thread");
    expect(restoredState.terminalVisible).toBe(true);
    expect(restoredState.restoreTerminalVisibleOnGitOpsClose).toBe(false);
  });

  it("restores the terminal when leaving git ops straight back to thread view", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "gitops",
        terminalVisible: false,
        restoreTerminalVisibleOnGitOpsClose: true,
      },
      {
        type: "show-view",
        view: "thread",
      },
    );

    expect(nextState.activeView).toBe("thread");
    expect(nextState.terminalVisible).toBe(true);
    expect(nextState.restoreTerminalVisibleOnGitOpsClose).toBe(false);
  });

  it("can swap the selected project without leaving a non-code view", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        activeView: "skills",
        selectedProjectId: "pi-plugin-codex",
      },
      {
        type: "set-selected-project",
        projectId: "claw-phone",
      },
    );

    expect(nextState.activeView).toBe("skills");
    expect(nextState.selectedProjectId).toBe("claw-phone");
  });

  it("clears thread-specific state when leaving thread view", () => {
    const nextState = workspaceReducer(
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

    expect(nextState.activeView).toBe("code");
    expect(nextState.selectedThreadId).toBeNull();
    expect(nextState.selectedSessionPath).toBeNull();
    expect(nextState.selectedDiffFilePath).toBeNull();
  });

  it("opens the archived threads view like any other main view", () => {
    const settingsState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        settingsOpen: true,
      },
      { type: "set-settings-panel-open", open: true },
    );

    expect(settingsState.settingsPanelOpen).toBe(true);
    expect(settingsState.settingsOpen).toBe(false);

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

  it("toggles and collapses all project groups", () => {
    const toggledState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "toggle-project-collapse",
      projectId: "pi-plugin-codex",
    });

    expect(toggledState.collapsedProjectIds["pi-plugin-codex"]).toBe(false);

    const collapsedState = workspaceReducer(toggledState, {
      type: "collapse-all-projects",
    });

    expect(Object.values(collapsedState.collapsedProjectIds).every(Boolean)).toBe(true);
  });

  it("can switch into takeover terminal mode", () => {
    const nextState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "show-takeover",
    });

    expect(nextState.takeoverVisible).toBe(true);
  });

  it("can hide takeover terminal mode", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        takeoverVisible: true,
      },
      { type: "hide-takeover" },
    );

    expect(nextState.takeoverVisible).toBe(false);
  });

  it("can explicitly control terminal drawer and takeover visibility", () => {
    const state = createInitialWorkspaceState(mockProjects);
    const withTerminalDrawer = workspaceReducer(state, {
      type: "set-terminal-visible",
      visible: true,
    });
    const withoutTakeover = workspaceReducer(
      {
        ...withTerminalDrawer,
        takeoverVisible: true,
      },
      { type: "set-takeover-visible", visible: false },
    );

    expect(withTerminalDrawer.terminalVisible).toBe(true);
    expect(withoutTakeover.takeoverVisible).toBe(false);
  });

  it("can store and clear per-session takeover overrides", () => {
    const state = createInitialWorkspaceState(mockProjects);
    const withOverride = workspaceReducer(state, {
      type: "set-session-takeover-override",
      sessionPath: "/tmp/thread.jsonl",
      visible: true,
    });
    const withoutOverride = workspaceReducer(withOverride, {
      type: "set-session-takeover-override",
      sessionPath: "/tmp/thread.jsonl",
      visible: null,
    });

    expect(withOverride.takeoverOverrides["/tmp/thread.jsonl"]).toBe(true);
    expect(withoutOverride.takeoverOverrides["/tmp/thread.jsonl"]).toBeUndefined();
  });

  it("migrates a takeover override from a local draft to the persisted thread session", () => {
    const nextState = workspaceReducer(
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

    expect(nextState.takeoverOverrides["local://%2Frepo/draft"]).toBeUndefined();
    expect(nextState.takeoverOverrides["/repo/.pi/thread-1.json"]).toBe(false);
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
