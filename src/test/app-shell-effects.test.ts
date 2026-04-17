import { describe, expect, it } from "vitest";
import {
  getVisibleDesktopSessionPath,
  shouldAutoOpenStartedThread,
} from "../app/app-shell/useAppShellEffects";

describe("app shell effects", () => {
  it("treats local draft threads as having no persisted visible session path", () => {
    expect(
      getVisibleDesktopSessionPath({
        activeView: "thread",
        selectedSessionPath: "local://%2Frepo/123",
        selectedInboxSessionPath: null,
      }),
    ).toBeNull();
  });

  it("uses the persisted thread session path when a real thread is visible", () => {
    expect(
      getVisibleDesktopSessionPath({
        activeView: "thread",
        selectedSessionPath: "/repo/.pi/sessions/thread.jsonl",
        selectedInboxSessionPath: null,
      }),
    ).toBe("/repo/.pi/sessions/thread.jsonl");
  });

  it("auto-opens a started thread from code view or a local draft thread view", () => {
    expect(
      shouldAutoOpenStartedThread("start", {
        activeView: "code",
        selectedSessionPath: null,
        selectedInboxSessionPath: null,
      }),
    ).toBe(true);

    expect(
      shouldAutoOpenStartedThread("start", {
        activeView: "thread",
        selectedSessionPath: "local://%2Frepo/123",
        selectedInboxSessionPath: null,
      }),
    ).toBe(true);
  });

  it("does not auto-open started threads when a persisted thread is already visible", () => {
    expect(
      shouldAutoOpenStartedThread("start", {
        activeView: "thread",
        selectedSessionPath: "/repo/.pi/sessions/thread.jsonl",
        selectedInboxSessionPath: null,
      }),
    ).toBe(false);
  });
});
