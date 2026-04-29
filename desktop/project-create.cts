import { execFile as execFileCallback } from "node:child_process";
import { mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDesktopWorkingDirectory } from "../shared/desktop-working-directory.ts";
import { startNewThread } from "./pi-desktop-runtime.cts";
import { initializeProjectGit } from "./project-git.cts";
import { formatGitCommandError, getNonInteractiveGitEnv } from "./project-git/git-runner.cts";
import { getOriginUrl, isGitRepository } from "./project-git/project-state.cts";
import {
  isSameGitHubRepository,
  parseGitHubRepositoryUrl,
} from "../shared/github-repository-url.ts";
import {
  ensureProject,
  listProjects,
  moveProjectToTop,
  setProjectRepoOrigin,
} from "./thread-state-db.cts";

const execFile = promisify(execFileCallback);

function sanitizeProjectFolderName(projectName: string) {
  let nextName = projectName
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ");

  nextName = Array.from(nextName, (char) => {
    const code = char.charCodeAt(0);
    return code >= 0 && code <= 31 ? "-" : char;
  }).join("");

  return nextName;
}

export async function createProject(options: {
  preferredProjectLocation: string | null;
  projectName: string;
  initializeGit: boolean;
}) {
  const preferredProjectLocation = options.preferredProjectLocation?.trim() ?? "";
  if (preferredProjectLocation.length === 0) {
    throw new Error("Set a default project location in Settings first.");
  }

  const folderName = sanitizeProjectFolderName(options.projectName);
  if (folderName.length === 0) {
    throw new Error("Enter a project name.");
  }

  const parentDirectory = path.resolve(preferredProjectLocation);
  const projectPath = path.join(parentDirectory, folderName);

  await mkdir(parentDirectory, { recursive: true });

  try {
    await mkdir(projectPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      throw new Error("A project with that name already exists there.");
    }

    throw error;
  }

  if (options.initializeGit) {
    await initializeProjectGit(projectPath);
  }

  const result = await startNewThread({ projectId: projectPath });
  moveProjectToTop(projectPath);
  return result;
}

async function resolvePathIfPresent(projectPath: string) {
  try {
    return await realpath(projectPath);
  } catch {
    return path.resolve(projectPath);
  }
}

async function directoryExists(directoryPath: string) {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
}

async function addExistingRepositoryProject(projectPath: string, repositoryUrl: string) {
  if (!(await directoryExists(projectPath)) || !(await isGitRepository(projectPath))) {
    return null;
  }

  const originUrl = await getOriginUrl(projectPath);
  if (!isSameGitHubRepository(originUrl, repositoryUrl)) {
    return null;
  }

  ensureProject(projectPath);
  setProjectRepoOrigin(projectPath, originUrl ?? repositoryUrl);
  moveProjectToTop(projectPath);
  return { projectId: projectPath };
}

async function findExistingGitHubProject(repositoryUrl: string) {
  const projects = listProjects(getDesktopWorkingDirectory());

  for (const project of projects) {
    if (isSameGitHubRepository(project.repoOriginUrl, repositoryUrl)) {
      return project.id;
    }
  }

  for (const project of projects) {
    if (!(await isGitRepository(project.id))) {
      continue;
    }

    const originUrl = await getOriginUrl(project.id);
    if (isSameGitHubRepository(originUrl, repositoryUrl)) {
      setProjectRepoOrigin(project.id, originUrl);
      return project.id;
    }
  }

  return null;
}

export async function createProjectFromGitHubUrl(options: {
  preferredProjectLocation: string | null;
  repositoryUrl: string;
}) {
  const preferredProjectLocation = options.preferredProjectLocation?.trim() ?? "";
  if (preferredProjectLocation.length === 0) {
    throw new Error("Set a default project location in Settings first.");
  }

  const repository = parseGitHubRepositoryUrl(options.repositoryUrl);
  if (!repository) {
    throw new Error("Paste a GitHub repository URL such as https://github.com/owner/repo.");
  }

  const existingProjectId = await findExistingGitHubProject(repository.canonicalUrl);
  if (existingProjectId) {
    moveProjectToTop(existingProjectId);
    return { projectId: existingProjectId };
  }

  const parentDirectory = path.resolve(preferredProjectLocation);
  const projectPath = path.join(parentDirectory, sanitizeProjectFolderName(repository.folderName));
  await mkdir(parentDirectory, { recursive: true });

  const existingDirectoryProject = await addExistingRepositoryProject(
    projectPath,
    repository.canonicalUrl,
  );
  if (existingDirectoryProject) {
    return existingDirectoryProject;
  }

  try {
    await execFile("git", ["clone", "--progress", repository.cloneUrl, projectPath], {
      cwd: parentDirectory,
      env: getNonInteractiveGitEnv(),
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 4,
    });
  } catch (error) {
    const resolvedProjectPath = await resolvePathIfPresent(projectPath);
    const resolvedExistingProject = await findExistingGitHubProject(repository.canonicalUrl);
    if (
      resolvedExistingProject &&
      (await resolvePathIfPresent(resolvedExistingProject)) === resolvedProjectPath
    ) {
      moveProjectToTop(resolvedExistingProject);
      return { projectId: resolvedExistingProject };
    }

    throw new Error(`Unable to clone ${repository.canonicalUrl}: ${formatGitCommandError(error)}`);
  }

  const result = await startNewThread({ projectId: projectPath });
  ensureProject(projectPath);
  setProjectRepoOrigin(projectPath, repository.canonicalUrl);
  moveProjectToTop(projectPath);
  return result;
}
