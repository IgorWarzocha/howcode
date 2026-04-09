import type { DesktopAction } from "../../shared/desktop-actions.ts";
import type { AnyDesktopActionPayload } from "../../shared/desktop-contracts.ts";
import {
  getComposerRequest,
  getGitCommitMessage,
  getGitIncludeUnstaged,
  getGitPreview,
  getGitPush,
  getGitRepoUrl,
  getProjectId,
} from "../../shared/pi-thread-action-payloads.ts";
import { generateGitCommitMessage } from "../git-commit-message.cts";
import { commitProjectChanges, initializeProjectGit, setProjectOrigin } from "../project-git.cts";
import { setProjectRepoOrigin } from "../thread-state-db.cts";
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

      if (repoUrl) {
        await setProjectOrigin(projectId, repoUrl);
        setProjectRepoOrigin(projectId, repoUrl);
        return handledAction();
      }

      await initializeProjectGit(projectId);
      setProjectRepoOrigin(projectId, null);
      return handledAction();
    }

    default:
      return unhandledAction();
  }
}
