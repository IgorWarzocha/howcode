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
    expect(state.selectedThreadId).toBe("inspect-current-repo");
    expect(state.collapsedProjectIds["claw-phone"]).toBe(true);
  });

  it("opens a thread and forces its project expanded", () => {
    const state = createInitialWorkspaceState(mockProjects);
    const nextState = workspaceReducer(state, {
      type: "open-thread",
      projectId: "claw-phone",
      threadId: "missing-thread",
    });

    expect(nextState.activeView).toBe("thread");
    expect(nextState.selectedProjectId).toBe("claw-phone");
    expect(nextState.collapsedProjectIds["claw-phone"]).toBe(false);
  });

  it("resolves fallback project and thread titles safely", () => {
    const project = selectProject(mockProjects, "missing-project");
    const thread = selectThread(project, "missing-thread");

    expect(getProjectName(project)).toBe("pi-plugin-codex");
    expect(getCurrentTitle("thread", thread)).toBe("Inspect current repo");
    expect(getCurrentTitle("home", thread)).toBe("New thread");
  });
});
