import { describe, expect, it } from "vitest";
import {
  getCatalogSkillSource,
  getInstalledSkillSlugs,
  isSkillCreatorCandidate,
  normalizeSkillSlug,
} from "../app/features/skills/utils";

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

  it("derives installed slugs from installed paths", () => {
    expect(
      getInstalledSkillSlugs([
        {
          source: "owner/repo",
          identityKey: "owner/repo@canonical-skill",
          displayName: "Canonical Skill",
          description: null,
          scope: "user",
          provenance: "skills.sh",
          installedPath: "/tmp/Skills/Canonical-Skill",
          skillFilePath: "/tmp/Skills/Canonical-Skill/SKILL.md",
          sourceRepo: "owner/repo",
          sourceUrl: "https://skills.sh/owner/repo/canonical-skill",
        },
      ]),
    ).toEqual(new Set(["canonical-skill"]));
  });

  it("detects skill creator candidates from install metadata", () => {
    expect(
      isSkillCreatorCandidate({
        source: "openai/skill-creator",
        identityKey: "openai/skill-creator@skill-creator",
        displayName: "Skill Creator",
        description: "Create and author new skills",
        scope: "user",
        provenance: "skills.sh",
        installedPath: "/tmp/skill-creator",
        skillFilePath: "/tmp/skill-creator/SKILL.md",
        sourceRepo: "openai/skill-creator",
        sourceUrl: "https://skills.sh/openai/skill-creator/skill-creator",
      }),
    ).toBe(true);
  });
});
