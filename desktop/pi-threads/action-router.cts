import { unlink } from "node:fs/promises";
import { Utils } from "electrobun/bun";
import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { DesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerRequest,
  getComposerText,
  getComposerThinkingLevel,
  getGitCommitMessage,
  getGitIncludeUnstaged,
  getGitPreview,
  getGitPush,
  getGitRepoUrl,
  getProjectId,
  getProjectIds,
  getProjectName,
  getSettingsBooleanValue,
  getSettingsFavoriteFolders,
  getSettingsKey,
  getSettingsModelSelection,
  getSettingsPreferredProjectLocation,
  getSettingsProjectImportState,
  getSettingsReset,
  getThreadId,
} from "../../shared/pi-thread-action-payloads.ts";
import {
  loadAppSettings,
  setFavoriteFolders,
  setGitCommitMessageModelSelection,
  setInitializeGitOnProjectCreate,
  setPreferredProjectLocation,
  setProjectImportState,
  setUseAgentsSkillsPaths,
} from "../app-settings.cts";
import { generateGitCommitMessage } from "../git-commit-message.cts";
import {
  openThreadRuntime,
  selectProjectRuntime,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  startNewThread,
} from "../pi-desktop-runtime.cts";
import { createProject } from "../project-create.cts";
import { commitProjectChanges, initializeProjectGit, setProjectOrigin } from "../project-git.cts";
import { getOriginUrl } from "../project-git/project-state.cts";
import { importProjects, scanKnownProjects } from "../project-import.cts";
import {
  archiveProjectThreads,
  archiveThread,
  collapseAllProjects,
  deleteThreadRecord,
  getThreadSessionPath,
  hideProject,
  renameProject,
  reorderProjects,
  restoreThread,
  setProjectCollapsed,
  setProjectRepoOrigin,
  toggleProjectPinned,
  toggleThreadPinned,
} from "../thread-state-db.cts";

async function deletePersistedThread(threadId: string) {
  const sessionPath = getThreadSessionPath(threadId);
  if (sessionPath) {
    try {
      await unlink(sessionPath);
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

  deleteThreadRecord(threadId);
}

export async function handleDesktopAction(
  action: DesktopAction,
  payload: DesktopActionPayload,
): Promise<Record<string, unknown> | null | undefined> {
  switch (action) {
    case "threads.filter":
    case "project.actions":
    case "project.create-worktree":
    case "project.switch":
    case "thread.actions":
    case "thread.run-action":
    case "workspace.open":
    case "workspace.open-options":
    case "workspace.handoff":
    case "workspace.popout":
    case "connections.add":
    case "connections.dismiss-banner":
    case "composer.attach-menu":
    case "composer.dictate":
    case "composer.host":
    case "plugins.open-card":
    case "automations.open-card":
    case "debug.open-card":
    case "landing.project-switcher":
    case "diff.review":
    case "terminal.close":
      return;

    case "project.add": {
      const appSettings = loadAppSettings();
      return await createProject({
        preferredProjectLocation: appSettings.preferredProjectLocation,
        projectName: getProjectName(payload) ?? "",
        initializeGit: appSettings.initializeGitOnProjectCreate,
      });
    }

    case "project.select":
      await selectProjectRuntime(getComposerRequest(payload));
      return;

    case "project.expand": {
      const projectId = getProjectId(payload);
      if (projectId) {
        setProjectCollapsed(projectId, false);
      }
      return;
    }

    case "project.collapse": {
      const projectId = getProjectId(payload);
      if (projectId) {
        setProjectCollapsed(projectId, true);
      }
      return;
    }

    case "project.open-in-file-manager": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return;
      }

      if (!Utils.openPath(projectId)) {
        throw new Error(`Unable to open path: ${projectId}`);
      }
      return;
    }

    case "project.reorder": {
      const projectIds = getProjectIds(payload);
      if (projectIds.length > 0) {
        reorderProjects(projectIds);
      }
      return;
    }

    case "project.pin": {
      const projectId = getProjectId(payload);
      if (projectId) {
        toggleProjectPinned(projectId);
      }
      return;
    }

    case "project.edit-name": {
      const projectId = getProjectId(payload);
      const projectName = getProjectName(payload);
      if (projectId && projectName) {
        renameProject(projectId, projectName);
      }
      return;
    }

    case "project.inspect-repo": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return;
      }

      const originUrl = await getOriginUrl(projectId);
      setProjectRepoOrigin(projectId, originUrl);
      return {
        projectId,
        originUrl,
      };
    }

    case "project.archive-threads": {
      const projectId = getProjectId(payload);
      if (projectId) {
        archiveProjectThreads(projectId);
      }
      return;
    }

    case "project.remove-project": {
      const projectId = getProjectId(payload);
      if (projectId) {
        hideProject(projectId);
      }
      return;
    }

    case "threads.collapse-all":
      collapseAllProjects();
      return;

    case "thread.pin": {
      const threadId = getThreadId(payload);
      if (threadId) {
        toggleThreadPinned(threadId);
      }
      return;
    }

    case "thread.open":
      await openThreadRuntime(getComposerRequest(payload));
      return;

    case "thread.archive": {
      const threadId = getThreadId(payload);
      if (threadId) {
        archiveThread(threadId);
      }
      return;
    }

    case "thread.restore": {
      const threadId = getThreadId(payload);
      if (threadId) {
        restoreThread(threadId);
      }
      return;
    }

    case "thread.delete": {
      const threadId = getThreadId(payload);
      if (threadId) {
        await deletePersistedThread(threadId);
      }
      return;
    }

    case "thread.new":
      return await startNewThread(getComposerRequest(payload));

    case "composer.model": {
      const selection = getComposerModelSelection(payload);
      if (selection) {
        await setComposerModel(getComposerRequest(payload), selection.provider, selection.modelId);
      }
      return;
    }

    case "composer.thinking": {
      const level = getComposerThinkingLevel(payload);
      if (level) {
        await setComposerThinkingLevel(getComposerRequest(payload), level);
      }
      return;
    }

    case "composer.send": {
      const text = getComposerText(payload);
      if (!text) {
        return;
      }

      await sendComposerPrompt({
        ...getComposerRequest(payload),
        text,
        attachments: getComposerAttachments(payload),
      });
      return;
    }

    case "workspace.commit": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return;
      }

      return await commitProjectChanges(projectId, {
        includeUnstaged: getGitIncludeUnstaged(payload),
        message: getGitCommitMessage(payload),
        preview: getGitPreview(payload),
        push: getGitPush(payload),
        generateMessage: (context) =>
          generateGitCommitMessage(getComposerRequest(payload), context),
      });
    }

    case "workspace.commit-options": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return;
      }

      const repoUrl = getGitRepoUrl(payload);

      if (repoUrl) {
        await setProjectOrigin(projectId, repoUrl);
        setProjectRepoOrigin(projectId, repoUrl);
        return;
      }

      await initializeProjectGit(projectId);
      setProjectRepoOrigin(projectId, null);
      return;
    }

    case "settings.update": {
      const key = getSettingsKey(payload);
      if (!key) {
        return;
      }

      if (key === "favoriteFolders") {
        setFavoriteFolders(getSettingsFavoriteFolders(payload));
        return;
      }

      if (key === "projectImportState") {
        setProjectImportState(getSettingsProjectImportState(payload));
        return;
      }

      if (key === "useAgentsSkillsPaths") {
        setUseAgentsSkillsPaths(getSettingsBooleanValue(payload) ?? false);
        return;
      }

      if (key === "preferredProjectLocation") {
        setPreferredProjectLocation(getSettingsPreferredProjectLocation(payload));
        return;
      }

      if (key === "initializeGitOnProjectCreate") {
        const value = getSettingsBooleanValue(payload);
        if (value !== null) {
          setInitializeGitOnProjectCreate(value);
        }
        return;
      }

      if (getSettingsReset(payload)) {
        setGitCommitMessageModelSelection(null);
        return;
      }

      const selection = getSettingsModelSelection(payload);
      if (selection) {
        setGitCommitMessageModelSelection(selection);
      }
      return;
    }

    case "projects.import.scan": {
      const projectIds = getProjectIds(payload);
      return {
        projects: await scanKnownProjects(projectIds),
      };
    }

    case "projects.import.apply": {
      return await importProjects(getProjectIds(payload));
    }
  }

  const exhaustiveAction: never = action;
  return exhaustiveAction;
}
