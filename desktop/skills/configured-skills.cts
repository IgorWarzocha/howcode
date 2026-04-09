import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PiConfiguredSkill } from "../../shared/desktop-contracts.ts";
import { parseSkillFrontmatter } from "./frontmatter.cts";
import { getGlobalSkillsDirs, getProjectSkillsDirs, pathExists } from "./paths.cts";

async function listSkillsInDirectory(
  skillsDirPath: string,
  scope: PiConfiguredSkill["scope"],
): Promise<PiConfiguredSkill[]> {
  if (!(await pathExists(skillsDirPath))) {
    return [];
  }

  const directoryEntries = await readdir(skillsDirPath, { withFileTypes: true });
  const skills: PiConfiguredSkill[] = [];

  for (const entry of directoryEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDirPath = path.join(skillsDirPath, entry.name);
    const skillFilePath = path.join(skillDirPath, "SKILL.md");

    if (!(await pathExists(skillFilePath))) {
      continue;
    }

    const markdown = await readFile(skillFilePath, "utf8");
    const frontmatter = parseSkillFrontmatter(markdown);
    const source = `local:${skillDirPath}`;

    skills.push({
      source,
      identityKey: source,
      displayName: frontmatter.name ?? entry.name,
      description: frontmatter.description ?? null,
      scope,
      provenance: "local",
      installedPath: skillDirPath,
      skillFilePath,
      sourceRepo: null,
      sourceUrl: null,
    });
  }

  return skills.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" }),
  );
}

function sortConfiguredSkills(skills: PiConfiguredSkill[]) {
  return [...skills].sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope === "user" ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
}

export async function listConfiguredPiSkills(
  request: { projectPath?: string | null } = {},
): Promise<PiConfiguredSkill[]> {
  const globalSkills = (
    await Promise.all(
      getGlobalSkillsDirs().map((skillsDirPath) => listSkillsInDirectory(skillsDirPath, "user")),
    )
  ).flat();
  const projectSkills = (
    await Promise.all(
      getProjectSkillsDirs(request.projectPath).map((skillsDirPath) =>
        listSkillsInDirectory(skillsDirPath, "project"),
      ),
    )
  ).flat();

  return sortConfiguredSkills([...globalSkills, ...projectSkills]);
}
