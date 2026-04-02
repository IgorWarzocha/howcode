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

  it("resolves fallback project and thread titles safely", () => {
    const project = selectProject(mockProjects, "missing-project");
    const thread = selectThread(project, "missing-thread");

    expect(getProjectName(project)).toBe("pi-plugin-codex");
    expect(thread).toBeUndefined();
    expect(getCurrentTitle("thread", thread)).toBe("New thread");
    expect(getCurrentTitle("home", thread)).toBe("New thread");
  });
});
