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

    expect(nextState.activeView).toBe("home");
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
    expect(nextState.collapsedProjectIds["claw-phone"]).toBe(false);
  });

  it("can switch into fullscreen terminal mode", () => {
    const nextState = workspaceReducer(createInitialWorkspaceState(mockProjects), {
      type: "show-full-terminal",
    });

    expect(nextState.terminalMode).toBe("fullscreen");
  });

  it("closes terminal mode when toggled from fullscreen", () => {
    const nextState = workspaceReducer(
      {
        ...createInitialWorkspaceState(mockProjects),
        terminalMode: "fullscreen",
      },
      { type: "toggle-terminal" },
    );

    expect(nextState.terminalMode).toBeNull();
  });

  it("resolves fallback project and thread titles safely", () => {
    const project = selectProject(mockProjects, "missing-project");
    const thread = selectThread(project, "missing-thread");

    expect(getProjectName(project)).toBe("pi-plugin-codex");
    expect(thread).toBeUndefined();
    expect(getCurrentTitle("thread", thread)).toBe("New thread");
    expect(getCurrentTitle("home", thread)).toBe("New thread");
  });
});
