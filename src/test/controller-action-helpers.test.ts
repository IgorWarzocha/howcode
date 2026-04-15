import { describe, expect, it } from "vitest";
import { buildContextualActionPayload } from "../app/app-shell/controller-action-helpers";

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
});
