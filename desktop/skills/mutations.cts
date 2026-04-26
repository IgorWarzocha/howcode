import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PiSkillMutationResult } from "../../shared/desktop-contracts.ts";
import { markRuntimeSettingsStaleForProject } from "../runtime/runtime-registry.cts";
import { type SkillDownloadApiFile, downloadSkillApi } from "./api.cts";
import { listConfiguredPiSkills } from "./configured-skills.cts";
import {
  getActiveGlobalSkillsRoot,
  getActiveProjectSkillsRoot,
  getGlobalSkillsDirs,
  getProjectSkillsDirs,
  isPathWithinRoot,
  isPathWithinRootDescendant,
  isValidSkillSlug,
  pathExists,
} from "./paths.cts";
import { parseSkillSource } from "./source.cts";

type DownloadedSkillTarget = {
  targetFilePath: string;
  contents: string;
};

function getDownloadedSkillTargets(targetDirPath: string, files: SkillDownloadApiFile[]) {
  const targets: DownloadedSkillTarget[] = [];

  for (const file of files) {
    if (typeof file.path !== "string" || typeof file.contents !== "string") {
      continue;
    }

    const targetFilePath = path.resolve(targetDirPath, file.path);
    if (!isPathWithinRoot(targetFilePath, targetDirPath)) {
      throw new Error("Downloaded skill contains an invalid file path.");
    }

    targets.push({
      targetFilePath,
      contents: file.contents,
    });
  }

  return targets;
}

async function writeDownloadedSkill(targetDirPath: string, targets: DownloadedSkillTarget[]) {
  await mkdir(targetDirPath, { recursive: true });

  for (const target of targets) {
    await mkdir(path.dirname(target.targetFilePath), { recursive: true });
    await writeFile(target.targetFilePath, target.contents, "utf8");
  }
}

export async function installPiSkill(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiSkillMutationResult> {
  const parsedSource = parseSkillSource(request.source);
  if (!parsedSource) {
    throw new Error(
      "Enter a skill source like owner/repo@skill or https://skills.sh/owner/repo/skill.",
    );
  }

  const download = await downloadSkillApi(parsedSource.repo, parsedSource.slug);
  const files = Array.isArray(download.files) ? download.files : [];

  if (files.length === 0) {
    throw new Error("Could not download that skill.");
  }

  const targetRootPath = request.local
    ? getActiveProjectSkillsRoot(request.projectPath)
    : getActiveGlobalSkillsRoot();
  if (!targetRootPath) {
    throw new Error("Select a project before installing a project-scoped skill.");
  }

  if (!isValidSkillSlug(parsedSource.slug)) {
    throw new Error("That skill has an invalid slug.");
  }

  const targetDirPath = path.resolve(targetRootPath, parsedSource.slug);
  if (!isPathWithinRoot(targetDirPath, targetRootPath)) {
    throw new Error("That skill resolves outside the skills directory.");
  }

  if (await pathExists(targetDirPath)) {
    throw new Error(`A skill already exists at ${parsedSource.slug}. Remove or rename it first.`);
  }

  await mkdir(targetRootPath, { recursive: true });
  const temporaryTargetDirPath = await mkdtemp(
    path.join(targetRootPath, `.tmp-${parsedSource.slug}-`),
  );

  try {
    const targets = getDownloadedSkillTargets(temporaryTargetDirPath, files);
    if (targets.length === 0) {
      throw new Error("Could not download that skill.");
    }

    await writeDownloadedSkill(temporaryTargetDirPath, targets);
    await rename(temporaryTargetDirPath, targetDirPath);
  } catch (error) {
    await rm(temporaryTargetDirPath, { recursive: true, force: true });
    throw error;
  }

  await markRuntimeSettingsStaleForProject(request.local ? request.projectPath : null);

  return {
    source: request.source,
    normalizedSource: parsedSource.normalizedSource,
    configuredSkills: await listConfiguredPiSkills({
      projectPath: request.projectPath ?? null,
    }),
  };
}

export async function removePiSkill(request: {
  installedPath: string;
  projectPath?: string | null;
}): Promise<PiSkillMutationResult> {
  const installedPath = path.resolve(request.installedPath);
  const globalRootPaths = getGlobalSkillsDirs();
  const projectRootPaths = getProjectSkillsDirs(request.projectPath);

  const isGlobalSkill = globalRootPaths.some((rootPath) =>
    isPathWithinRootDescendant(installedPath, rootPath),
  );
  const isProjectSkill = projectRootPaths.some((rootPath) =>
    isPathWithinRootDescendant(installedPath, rootPath),
  );

  if (!isGlobalSkill && !isProjectSkill) {
    throw new Error("That skill cannot be removed from here.");
  }

  await rm(installedPath, { recursive: true, force: true });
  await markRuntimeSettingsStaleForProject(isGlobalSkill ? null : request.projectPath);

  return {
    source: installedPath,
    normalizedSource: installedPath,
    configuredSkills: await listConfiguredPiSkills({
      projectPath: request.projectPath ?? null,
    }),
  };
}
