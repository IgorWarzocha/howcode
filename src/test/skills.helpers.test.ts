import { describe, expect, it } from "vitest";
import { getCatalogSkillSource, normalizeSkillSlug } from "../app/views/skills/helpers";

describe("skills helpers", () => {
  it("normalizes installed skill slugs", () => {
    expect(normalizeSkillSlug(" Canonical-Skill ")).toBe("canonical-skill");
  });

  it("builds install sources from the canonical skill id", () => {
    expect(
      getCatalogSkillSource({
        source: "owner/repo",
        skillId: "canonical-skill",
      }),
    ).toBe("owner/repo@canonical-skill");
  });
});
