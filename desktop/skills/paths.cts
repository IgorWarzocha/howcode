import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadAppSettings } from "../app-settings.cts";

export async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function getGlobalNativeSkillsDir() {
  return path.join(os.homedir(), ".pi", "agent", "skills");
}

export function getGlobalInteropSkillsDir() {
  return path.join(os.homedir(), ".agents", "skills");
}

export function getProjectNativeSkillsDir(projectPath?: string | null) {
  if (!projectPath?.trim()) {
    return null;
  }

  return path.join(path.resolve(projectPath), ".pi", "skills");
}

export function getProjectInteropSkillsDir(projectPath?: string | null) {
  if (!projectPath?.trim()) {
    return null;
  }

  return path.join(path.resolve(projectPath), ".agents", "skills");
}

export function getGlobalSkillsDirs() {
  return [getGlobalNativeSkillsDir(), getGlobalInteropSkillsDir()];
}

export function getProjectSkillsDirs(projectPath?: string | null) {
  return [getProjectNativeSkillsDir(projectPath), getProjectInteropSkillsDir(projectPath)].filter(
    (skillsDirPath): skillsDirPath is string => Boolean(skillsDirPath),
  );
}

export function getActiveGlobalSkillsRoot() {
  return loadAppSettings().useAgentsSkillsPaths
    ? getGlobalInteropSkillsDir()
    : getGlobalNativeSkillsDir();
}

export function getActiveProjectSkillsRoot(projectPath?: string | null) {
  return loadAppSettings().useAgentsSkillsPaths
    ? getProjectInteropSkillsDir(projectPath)
    : getProjectNativeSkillsDir(projectPath);
}

export function isValidSkillSlug(slug: string) {
  const trimmedSlug = slug.trim();

  return (
    trimmedSlug.length > 0 &&
    trimmedSlug !== "." &&
    trimmedSlug !== ".." &&
    !trimmedSlug.includes("/") &&
    !trimmedSlug.includes("\\")
  );
}

export function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}
