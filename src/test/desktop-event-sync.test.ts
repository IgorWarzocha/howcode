import { describe, expect, it } from "vitest";
import { createLocalThreadDraft } from "../../shared/session-paths";
import {
  getVisibleDesktopSessionPath,
  shouldAutoOpenStartedThread,
  type DesktopEventSelectionState,
} from "../app/app-shell/desktop-event-sync";

function selectionState(
  overrides: Partial<DesktopEventSelectionState> = {},
): DesktopEventSelectionState {
  return {
    activeView: "code",
    selectedProjectId: "/repo/project-a",
    selectedSessionPath: null,
    selectedInboxSessionPath: null,
    ...overrides,
  };
}

describe("desktop event selection helpers", () => {
  it("does not treat a local draft thread as a visible persisted session", () => {
    const draft = createLocalThreadDraft("/repo/project-b", "draft");

    expect(
      getVisibleDesktopSessionPath(
        selectionState({
          activeView: "thread",
          selectedProjectId: draft.projectId,
          selectedSessionPath: draft.sessionPath,
        }),
      ),
    ).toBeNull();
  });

  it("does not auto-open a started background thread over a local draft in another project", () => {
    const draft = createLocalThreadDraft("/repo/project-b", "draft");

    expect(
      shouldAutoOpenStartedThread({
        reason: "start",
        projectId: "/repo/project-a",
        workspaceState: selectionState({
          activeView: "thread",
          selectedProjectId: draft.projectId,
          selectedSessionPath: draft.sessionPath,
        }),
      }),
    ).toBe(false);
  });

  it("does not auto-open over a local draft even when the background thread is in the same project", () => {
    const draft = createLocalThreadDraft("/repo/project-a", "draft");

    expect(
      shouldAutoOpenStartedThread({
        reason: "start",
        projectId: draft.projectId,
        workspaceState: selectionState({
          activeView: "thread",
          selectedProjectId: draft.projectId,
          selectedSessionPath: draft.sessionPath,
        }),
      }),
    ).toBe(false);
  });

  it("does not auto-open a started background thread over an empty thread view in another project", () => {
    expect(
      shouldAutoOpenStartedThread({
        reason: "start",
        projectId: "/repo/project-a",
        workspaceState: selectionState({
          activeView: "thread",
          selectedProjectId: "/repo/project-b",
          selectedSessionPath: null,
        }),
      }),
    ).toBe(false);
  });

  it("keeps same-project auto-open behavior for empty thread and code views", () => {
    expect(
      shouldAutoOpenStartedThread({
        reason: "start",
        projectId: "/repo/project-a",
        workspaceState: selectionState({ activeView: "thread", selectedSessionPath: null }),
      }),
    ).toBe(true);

    expect(
      shouldAutoOpenStartedThread({
        reason: "start",
        projectId: "/repo/project-a",
        workspaceState: selectionState({ activeView: "code" }),
      }),
    ).toBe(true);
  });

  it("does not auto-open non-start updates or when a persisted session is visible", () => {
    expect(
      shouldAutoOpenStartedThread({
        reason: "end",
        projectId: "/repo/project-a",
        workspaceState: selectionState({ activeView: "thread", selectedSessionPath: null }),
      }),
    ).toBe(false);

    expect(
      shouldAutoOpenStartedThread({
        reason: "start",
        projectId: "/repo/project-a",
        workspaceState: selectionState({
          activeView: "thread",
          selectedSessionPath: "/sessions/project-a.jsonl",
        }),
      }),
    ).toBe(false);
  });
});
