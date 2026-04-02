import { unlink } from "node:fs/promises";
import { shell } from "electron";
import type { DesktopAction } from "../../shared/desktop-actions.js";
import type { DesktopActionPayload } from "../../shared/desktop-contracts.js";
import {
  getComposerAttachments,
  getComposerModelSelection,
  getComposerRequest,
  getComposerText,
  getComposerThinkingLevel,
  getProjectId,
  getProjectName,
  getThreadId,
} from "../../shared/pi-thread-action-payloads.js";
import {
  openThreadRuntime,
  selectProjectRuntime,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  startNewThread,
} from "../pi-desktop-runtime.cjs";
import {
  archiveProjectThreads,
  archiveThread,
  collapseAllProjects,
  deleteThreadRecord,
  getThreadSessionPath,
  hideProject,
  renameProject,
  restoreThread,
  setProjectCollapsed,
  toggleThreadPinned,
} from "../thread-state-db.cjs";

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
): Promise<void> {
  switch (action) {
    case "nav.back":
    case "nav.forward":
    case "threads.filter":
    case "project.add":
    case "project.actions":
    case "project.create-worktree":
    case "project.switch":
    case "thread.actions":
    case "thread.run-action":
    case "workspace.open":
    case "workspace.open-options":
    case "workspace.commit":
    case "workspace.commit-options":
    case "workspace.popout":
    case "connections.add":
    case "connections.dismiss-banner":
    case "composer.attach-menu":
    case "composer.dictate":
    case "composer.host":
    case "composer.profile":
    case "plugins.open-card":
    case "automations.open-card":
    case "debug.open-card":
    case "landing.project-switcher":
    case "diff.review":
    case "terminal.close":
      return;

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

      const error = await shell.openPath(projectId);
      if (error) {
        throw new Error(error);
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
      await startNewThread(getComposerRequest(payload));
      return;

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
  }

  const exhaustiveAction: never = action;
  return exhaustiveAction;
}
