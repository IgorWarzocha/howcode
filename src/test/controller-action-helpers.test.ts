import { describe, expect, it } from "vitest";
import {
  buildContextualActionPayload,
  buildPendingProjectAction,
  shouldConfirmProjectAction,
} from "../app/app-shell/controller-action-helpers";

describe("controller action helpers", () => {
  it("adds composer context only for composer actions", () => {
    expect(
      buildContextualActionPayload({
        action: "composer.send",
        payload: { text: "hello" },
        composerProjectId: "/repo",
        activeView: "thread",
        selectedSessionPath: "/repo/session.json",
      }),
    ).toEqual({
      projectId: "/repo",
      sessionPath: "/repo/session.json",
      text: "hello",
    });

    expect(
      buildContextualActionPayload({
        action: "thread.open",
        payload: { threadId: "t1" },
        composerProjectId: "/repo",
        activeView: "thread",
        selectedSessionPath: "/repo/session.json",
      }),
    ).toEqual({ threadId: "t1" });
  });

  it("builds pending project confirmation payloads", () => {
    expect(
      buildPendingProjectAction("project.edit-name", { projectId: "p1" }, [
        {
          id: "p1",
          name: "Chat",
          threads: [],
          threadCount: 0,
          collapsed: false,
          threadsLoaded: true,
        },
      ]),
    ).toEqual({
      action: "project.edit-name",
      projectId: "p1",
      projectName: "Chat",
    });
  });

  it("recognizes confirmation-only project actions", () => {
    expect(shouldConfirmProjectAction("project.edit-name")).toBe(true);
    expect(shouldConfirmProjectAction("thread.open")).toBe(false);
  });
});
