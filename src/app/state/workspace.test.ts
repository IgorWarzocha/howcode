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
    expect(nextState.selectedDiffTurnCount).toBeNull();
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
    expect(nextState.collapsedProjectIds["claw-phone"]).toBe(false);
    expect(nextState.selectedDiffTurnCount).toBeNull();
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

  it("can open git ops with a selected turn and file", () => {
    const nextState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "open-gitops",
      checkpointTurnCount: 3,
      filePath: "src/app/AppShell.tsx",
    });

    expect(nextState.activeView).toBe("gitops");
    expect(nextState.selectedDiffTurnCount).toBe(3);
    expect(nextState.selectedDiffFilePath).toBe("src/app/AppShell.tsx");
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
        selectedDiffTurnCount: 3,
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
    expect(nextState.selectedDiffTurnCount).toBeNull();
    expect(nextState.selectedDiffFilePath).toBeNull();
  });

  it("keeps settings and archived panels mutually exclusive", () => {
    const settingsState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        settingsOpen: true,
        archivedThreadsOpen: true,
      },
      { type: "set-settings-panel-open", open: true },
    );

    expect(settingsState.settingsPanelOpen).toBe(true);
    expect(settingsState.settingsOpen).toBe(false);
    expect(settingsState.archivedThreadsOpen).toBe(false);

    const archivedState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        settingsOpen: true,
        settingsPanelOpen: true,
      },
      { type: "set-archived-threads-open", open: true },
    );

    expect(archivedState.archivedThreadsOpen).toBe(true);
    expect(archivedState.settingsOpen).toBe(false);
    expect(archivedState.settingsPanelOpen).toBe(false);
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

  it("can explicitly control docked terminal and takeover visibility", () => {
    const state = createInitialWorkspaceState(mockProjects);
    const withDockedTerminal = workspaceReducer(state, {
      type: "set-terminal-visible",
      visible: true,
    });
    const withoutTakeover = workspaceReducer(
      {
        ...withDockedTerminal,
        takeoverVisible: true,
      },
      { type: "set-takeover-visible", visible: false },
    );

    expect(withDockedTerminal.terminalVisible).toBe(true);
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

  it("resolves fallback project and thread titles safely", () => {
    const project = selectProject(mockProjects, "missing-project");
    const thread = selectThread(project, "missing-thread");

    expect(getProjectName(project)).toBe("pi-plugin-codex");
    expect(thread).toBeUndefined();
    expect(getCurrentTitle("thread", thread)).toBe("New thread");
    expect(getCurrentTitle("gitops", thread)).toBe("Git ops");
    expect(getCurrentTitle("code", thread)).toBe("New thread");
  });
});
