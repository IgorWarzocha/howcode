import { describe, expect, it } from "vitest";
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerRequest,
  getComposerText,
  getComposerThinkingLevel,
  getProjectId,
  getProjectName,
  getThreadId,
} from "../../shared/pi-thread-action-payloads";

describe("pi thread action payloads", () => {
  it("extracts project and thread ids safely", () => {
    expect(getProjectId({ projectId: "/tmp/project" })).toBe("/tmp/project");
    expect(getProjectId({ projectId: 12 })).toBeNull();
    expect(getThreadId({ threadId: "thread-1" })).toBe("thread-1");
    expect(getThreadId({})).toBeNull();
  });

  it("builds a composer request from payload data", () => {
    expect(
      getComposerRequest({ projectId: "/tmp/project", sessionPath: "/tmp/thread.jsonl" }),
    ).toEqual({
      projectId: "/tmp/project",
      sessionPath: "/tmp/thread.jsonl",
    });

    expect(getComposerRequest({ projectId: 42, sessionPath: false })).toEqual({
      projectId: null,
      sessionPath: null,
    });

    expect(getProjectName({ projectName: "  Renamed project  " })).toBe("Renamed project");
    expect(getProjectName({ projectName: "   " })).toBeNull();
  });

  it("filters invalid attachments and trims composer text", () => {
    expect(
      getComposerAttachments({
        attachments: [
          { path: "/tmp/file.txt", name: "file.txt", kind: "text" },
          { path: "/tmp/image.png", name: "image.png", kind: "image" },
          { path: "/tmp/invalid.bin", name: "invalid.bin", kind: "binary" },
          null,
        ],
      }),
    ).toEqual([
      { path: "/tmp/file.txt", name: "file.txt", kind: "text" },
      { path: "/tmp/image.png", name: "image.png", kind: "image" },
    ]);

    expect(getComposerText({ text: "  hello pi  " })).toBe("hello pi");
    expect(getComposerText({ text: 5 })).toBe("");
  });

  it("validates model and thinking selections", () => {
    expect(getComposerModelSelection({ provider: "openai", modelId: "gpt-5" })).toEqual({
      provider: "openai",
      modelId: "gpt-5",
    });
    expect(getComposerModelSelection({ provider: "openai" })).toBeNull();

    expect(getComposerThinkingLevel({ level: "high" })).toBe("high");
    expect(getComposerThinkingLevel({ level: "turbo" })).toBeNull();
  });
});
