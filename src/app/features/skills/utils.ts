import type { PiConfiguredSkill, PiSkillCatalogItem } from "../../desktop/types";
import { getSafeExternalUrl } from "../../../../shared/external-url";
import { getActionError } from "../../utils/action-error";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export { getActionError };

export function formatInstalls(installs: number) {
  return `${compactNumberFormatter.format(installs)} installs`;
}

export function normalizeSkillSlug(slug: string) {
  return slug.trim().toLowerCase();
}

export function getCatalogSkillSource(skill: Pick<PiSkillCatalogItem, "source" | "skillId">) {
  return `${skill.source}@${skill.skillId}`;
}

export function isDesktopSkillsAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiSkills);
}

export async function openExternalUrl(url: string) {
  const safeUrl = getSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  if (window.piDesktop?.openExternal) {
    return window.piDesktop.openExternal(safeUrl);
  }

  window.open(safeUrl, "_blank", "noopener,noreferrer");
  return true;
}

function getPathBasename(targetPath: string) {
  const segments = targetPath.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export function getInstalledSkillSlugs(skills: PiConfiguredSkill[]) {
  return new Set(
    skills.map((skill) => normalizeSkillSlug(getPathBasename(skill.installedPath))).filter(Boolean),
  );
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
