import { readdir, realpath, rm, unlink } from "node:fs/promises";
import path from "node:path";
import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import {
  getComposerRequest,
  getProjectId,
  getProjectIds,
  getProjectName,
} from "../../shared/pi-thread-action-payloads.ts";
import { loadAppSettings } from "../app-settings.cts";
import { selectProjectRuntime } from "../pi-desktop-runtime.cts";
import { createProject } from "../project-create.cts";
import { getOriginUrl } from "../project-git/project-state.cts";
import { importProjects, scanKnownProjects } from "../project-import.cts";
import { openPathWithSystem } from "../system-open-path.cts";
import { listTerminals } from "../terminal/manager.cts";
import {
  archiveProjectThreads,
  collapseAllProjects,
  deleteProject,
  deleteThreadRecordsBySessionPaths,
  hasProject,
  hasRunningProjectThread,
  listProjectSessionPaths,
  renameProject,
  reorderProjects,
  setProjectCollapsed,
  setProjectRepoOrigin,
  toggleProjectPinned,
} from "../thread-state-db.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";
import { resolveProjectImportActionResult } from "./project-import-action.ts";
import { refreshShellIndex } from "./shell-loader.cts";

async function unlinkIfPresent(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

async function removeDirectoryIfEmpty(directoryPath: string) {
  try {
    const entries = await readdir(directoryPath);
    if (entries.length > 0) {
      return;
    }

    await rm(directoryPath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTEMPTY" || error.code === "ENOTDIR")
    ) {
      return;
    }

    throw error;
  }
}

async function deleteProjectPiFiles(projectId: string) {
  const sessionPaths = listProjectSessionPaths(projectId);
  const resolvedProjectId = path.resolve(projectId);
  const removableDirectories = new Set<string>();
  const deletedSessionPaths: string[] = [];
  const failedSessionPaths: string[] = [];

  for (const sessionPath of sessionPaths) {
    try {
      await unlinkIfPresent(sessionPath);
      deletedSessionPaths.push(sessionPath);
    } catch (error) {
      console.warn(`Failed to remove Pi session file for ${projectId}: ${sessionPath}`, error);
      failedSessionPaths.push(sessionPath);
      continue;
    }

    let currentDirectory = path.dirname(path.resolve(sessionPath));
    while (currentDirectory.startsWith(`${resolvedProjectId}${path.sep}`)) {
      removableDirectories.add(currentDirectory);
      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) {
        break;
      }
      currentDirectory = parentDirectory;
    }
  }

  for (const directoryPath of [...removableDirectories].sort(
    (left, right) => right.length - left.length,
  )) {
    try {
      await removeDirectoryIfEmpty(directoryPath);
    } catch (error) {
      console.warn(
        `Failed to remove empty Pi session directory for ${projectId}: ${directoryPath}`,
        error,
      );
    }
  }

  return {
    deletedSessionPaths,
    failedSessionPaths,
  };
}

async function resolveProjectPathForComparison(projectId: string) {
  const resolvedProjectId = path.resolve(projectId);

  try {
    return await realpath(resolvedProjectId);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code !== "ENOENT"
    ) {
      console.warn(`Failed to resolve project path for comparison: ${resolvedProjectId}`, error);
    }

    return resolvedProjectId;
  }
}

async function isProtectedProjectDeletionTarget(projectId: string, activeProjectId: string) {
  const [resolvedProjectId, resolvedActiveProjectId] = await Promise.all([
    resolveProjectPathForComparison(projectId),
    resolveProjectPathForComparison(activeProjectId),
  ]);
  const relativePath = path.relative(resolvedProjectId, resolvedActiveProjectId);
  const isOutsideCandidate =
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);

  return relativePath.length === 0 || !isOutsideCandidate;
}

async function isBusyProjectDeletionTarget(projectId: string) {
  if (hasRunningProjectThread(projectId)) {
    return true;
  }

  const terminalSnapshots = await listTerminals();
  return terminalSnapshots.some(
    (snapshot) =>
      snapshot.projectId === projectId &&
      (snapshot.status === "starting" || snapshot.status === "running"),
  );
}

export async function handleProjectDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case "project.add": {
      const appSettings = loadAppSettings();
      return handledAction(
        await createProject({
          preferredProjectLocation: appSettings.preferredProjectLocation,
          projectName: getProjectName(payload) ?? "",
          initializeGit: appSettings.initializeGitOnProjectCreate,
        }),
      );
    }

    case "project.select":
      await selectProjectRuntime(getComposerRequest(payload));
      return handledAction();

    case "project.expand": {
      const projectId = getProjectId(payload);
      if (projectId) {
        setProjectCollapsed(projectId, false);
      }
      return handledAction();
    }

    case "project.collapse": {
      const projectId = getProjectId(payload);
      if (projectId) {
        setProjectCollapsed(projectId, true);
      }
      return handledAction();
    }

    case "project.open-in-file-manager": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return handledAction();
      }

      if (!(await openPathWithSystem(projectId))) {
        throw new Error(`Unable to open path: ${projectId}`);
      }

      return handledAction();
    }

    case "project.reorder": {
      const projectIds = getProjectIds(payload);
      if (projectIds.length > 0) {
        reorderProjects(projectIds);
      }
      return handledAction();
    }

    case "project.pin": {
      const projectId = getProjectId(payload);
      if (projectId) {
        toggleProjectPinned(projectId);
      }
      return handledAction();
    }

    case "project.edit-name": {
      const projectId = getProjectId(payload);
      const projectName = getProjectName(payload);
      if (projectId && projectName) {
        renameProject(projectId, projectName);
      }
      return handledAction();
    }

    case "project.refresh-repo-origin": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return handledAction();
      }

      const originUrl = await getOriginUrl(projectId);
      setProjectRepoOrigin(projectId, originUrl);
      return handledAction({ projectId, originUrl });
    }

    case "project.archive-threads": {
      const projectId = getProjectId(payload);
      if (projectId) {
        archiveProjectThreads(projectId);
      }
      return handledAction();
    }

    case "project.remove-project": {
      const projectId = getProjectId(payload);
      if (projectId) {
        if (!hasProject(projectId)) {
          return handledAction({
            error: "Cannot delete a project that is not managed by Pi.",
          });
        }

        if (await isProtectedProjectDeletionTarget(projectId, getDesktopWorkingDirectory())) {
          return handledAction({
            error: "Cannot delete the active shell project.",
          });
        }

        if (await isBusyProjectDeletionTarget(projectId)) {
          return handledAction({
            error: "Cannot delete a project while Pi or a terminal is still running in it.",
          });
        }

        const appSettings = loadAppSettings();

        if (appSettings.projectDeletionMode === "full-clean") {
          await rm(projectId, { recursive: true, force: true });
          deleteProject(projectId);
        } else {
          const cleanupResult = await deleteProjectPiFiles(projectId);

          if (cleanupResult.failedSessionPaths.length > 0) {
            deleteThreadRecordsBySessionPaths(cleanupResult.deletedSessionPaths);

            return handledAction({
              didMutate: cleanupResult.deletedSessionPaths.length > 0,
              error:
                `Deleted ${cleanupResult.deletedSessionPaths.length} Pi session file(s), ` +
                `but ${cleanupResult.failedSessionPaths.length} could not be removed.`,
            });
          }

          deleteProject(projectId);
        }
      }
      return handledAction();
    }

    case "threads.collapse-all":
      collapseAllProjects();
      return handledAction();

    case "projects.import.scan": {
      const projectIds = getProjectIds(payload);
      return handledAction(
        await resolveProjectImportActionResult({
          cwd: getDesktopWorkingDirectory(),
          mode: "scan",
          projectIds,
          refreshOptions: { force: true },
          refreshShellIndex,
          runAfterRefresh: async (refreshedProjectIds) => ({
            projects: await scanKnownProjects(refreshedProjectIds),
          }),
        }),
      );
    }

    case "projects.import.apply": {
      const projectIds = getProjectIds(payload);
      return handledAction(
        await resolveProjectImportActionResult({
          cwd: getDesktopWorkingDirectory(),
          mode: "import",
          projectIds,
          refreshOptions: { emitRefreshEvent: false, force: true },
          refreshShellIndex,
          runAfterRefresh: importProjects,
        }),
      );
    }

    default:
      return unhandledAction();
  }
}
