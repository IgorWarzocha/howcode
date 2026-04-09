import type { PiConfiguredSkill } from "../../desktop/types";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function formatInstalls(installs: number) {
  return `${compactNumberFormatter.format(installs)} installs`;
}

export function isDesktopSkillsAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiSkills);
}

export async function openExternalUrl(url: string) {
  if (window.piDesktop?.openExternal) {
    await window.piDesktop.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function getInstalledIdentityKeys(skills: PiConfiguredSkill[]) {
  return new Set(skills.map((skill) => skill.identityKey));
}

function getSkillCreatorDetectionText(skill: PiConfiguredSkill) {
  return [
    skill.displayName,
    skill.description,
    skill.identityKey,
    skill.source,
    skill.installedPath,
    skill.skillFilePath,
    skill.sourceRepo,
    skill.sourceUrl,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSkillCreatorCandidate(skill: PiConfiguredSkill) {
  const normalized = getSkillCreatorDetectionText(skill);

  if (!normalized) {
    return false;
  }

  const creatorPatterns = [
    /\bskill(?:s)?\s*(?:creator|create|creation|maker|making|author|authoring|builder|build|craft(?:er)?|smith)\b/i,
    /\b(?:creator|create|creation|maker|making|author|authoring|builder|build|craft(?:er)?|smith)\s*skill(?:s)?\b/i,
    /\b(?:create|build|author|make|craft)\s+skills?\b/i,
  ];

  if (creatorPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const hasSkillToken = tokens.has("skill") || tokens.has("skills");
  const hasCreatorToken = [
    "create",
    "creator",
    "creation",
    "maker",
    "making",
    "author",
    "authoring",
    "builder",
    "build",
    "craft",
    "crafter",
    "smith",
  ].some((token) => tokens.has(token));

  return hasSkillToken && hasCreatorToken;
}
