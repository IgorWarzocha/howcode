import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import {
  getComposerRequest,
  getGitCommitMessage,
  getGitIncludeUnstaged,
  getGitOpsMode,
  getGitPreview,
  getGitPush,
  getGitRepoUrl,
  getProjectDiffBaselinePreference,
  getProjectDiffRenderModePreference,
  getProjectId,
} from "../../shared/pi-thread-action-payloads.ts";
import { generateGitCommitMessage } from "../git-commit-message.cts";
import { commitProjectChanges, initializeProjectGit, setProjectOrigin } from "../project-git.cts";
import {
  setProjectGitOpsMode,
  setProjectRepoOrigin,
  setThreadDiffPreferences,
} from "../thread-state-db.cts";
import type { ActionHandlerResult } from "./action-router-result.cts";
import { handledAction, unhandledAction } from "./action-router-result.cts";

export async function handleWorkspaceDesktopAction(
  action: DesktopAction,
  payload: AnyDesktopActionPayload,
): Promise<ActionHandlerResult> {
  switch (action) {
    case "workspace.commit": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return handledAction();
      }

      return handledAction(
        await commitProjectChanges(projectId, {
          includeUnstaged: getGitIncludeUnstaged(payload),
          message: getGitCommitMessage(payload),
          preview: getGitPreview(payload),
          push: getGitPush(payload),
          // AI commit messages are intentionally wired here: when Git Ops sends no explicit
          // message, commitProjectChanges calls this generator before falling back to defaults.
          generateMessage: (context) =>
            generateGitCommitMessage(getComposerRequest(payload), context),
        }),
      );
    }

    case "workspace.commit-options": {
      const projectId = getProjectId(payload);
      if (!projectId) {
        return handledAction();
      }

      const repoUrl = getGitRepoUrl(payload);
      const gitOpsMode = getGitOpsMode(payload);

      if (gitOpsMode === "invalid") {
        return handledAction({ error: "Invalid GitOps mode." });
      }

      if (gitOpsMode !== undefined && repoUrl) {
        return handledAction({ error: "GitOps mode and repository URL must be saved separately." });
      }

      if (gitOpsMode !== undefined) {
        setProjectGitOpsMode(projectId, gitOpsMode);
        return handledAction();
      }

      if (repoUrl) {
        await setProjectOrigin(projectId, repoUrl);
        setProjectRepoOrigin(projectId, repoUrl);
        return handledAction();
      }

      await initializeProjectGit(projectId);
      setProjectRepoOrigin(projectId, null);
      return handledAction();
    }

    case "workspace.diff-preferences": {
      const sessionPath = getPersistedSessionPath(
        typeof payload.sessionPath === "string" ? payload.sessionPath : null,
      );
      if (!sessionPath) {
        return handledAction({
          error: "Diff preferences can only be saved for persisted sessions.",
        });
      }

      const baseline = getProjectDiffBaselinePreference(payload);
      const renderMode = getProjectDiffRenderModePreference(payload);

      if (baseline === "invalid") {
        return handledAction({ error: "Invalid diff baseline." });
      }

      if (renderMode === "invalid") {
        return handledAction({ error: "Invalid diff render mode." });
      }

      const saved = setThreadDiffPreferences(sessionPath, {
        ...(baseline !== undefined ? { baseline } : {}),
        ...(renderMode !== undefined ? { renderMode } : {}),
      });
      if (!saved) {
        return handledAction({ error: "Could not save diff preferences for this session." });
      }
      return handledAction();
    }

    default:
      return unhandledAction();
  }
}
