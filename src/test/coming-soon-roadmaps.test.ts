import { describe, expect, it } from "vitest";
import { getComingSoonViewContent } from "../app/views/coming-soon-roadmaps";

describe("coming soon roadmaps", () => {
  it("returns markdown-backed content for each upcoming sidebar view", () => {
    expect(getComingSoonViewContent("chat")).toMatchObject({
      title: "Chat roadmap",
    });
    expect(getComingSoonViewContent("chat").markdown).toContain("What this view is for");

    expect(getComingSoonViewContent("claw")).toMatchObject({
      title: "Claw roadmap",
    });
    expect(getComingSoonViewContent("claw").markdown).toContain("automation lane");

    expect(getComingSoonViewContent("work")).toMatchObject({
      title: "Work roadmap",
    });
    expect(getComingSoonViewContent("work").markdown).toContain("workspace lane");
  });
});
