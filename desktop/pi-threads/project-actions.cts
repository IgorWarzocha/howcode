import { Utils } from "electrobun/bun";
import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
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
import {
  archiveProjectThreads,
  collapseAllProjects,
  hideProject,
  renameProject,
  reorderProjects,
  setProjectCollapsed,
  setProjectRepoOrigin,
  toggleProjectPinned,
} from "../thread-state-db.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

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

      if (!Utils.openPath(projectId)) {
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
        hideProject(projectId);
      }
      return handledAction();
    }

    case "threads.collapse-all":
      collapseAllProjects();
      return handledAction();

    case "projects.import.scan":
      return handledAction({
        projects: await scanKnownProjects(getProjectIds(payload)),
      });

    case "projects.import.apply":
      return handledAction(await importProjects(getProjectIds(payload)));

    default:
      return unhandledAction();
  }
}
