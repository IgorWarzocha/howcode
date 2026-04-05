import { buildDefaultCommitMessage, prepareCommitMessageContext } from "./commit-context.cts";
import {
  formatGitCommandError,
  getNonInteractiveGitEnv,
  runGit,
  runGitWithOptions,
} from "./git-runner.cts";
import { getOriginUrl, isGitRepository } from "./project-state.cts";
import type { CommitMessageContext } from "./types.cts";

export async function initializeProjectGit(projectId: string) {
  if (await isGitRepository(projectId)) {
    return;
  }

  await runGit(projectId, ["init"]);
}

export async function setProjectOrigin(projectId: string, repoUrl: string) {
  if (!(await isGitRepository(projectId))) {
    return;
  }

  const currentOriginUrl = await getOriginUrl(projectId);

  if (currentOriginUrl) {
    await runGit(projectId, ["remote", "set-url", "origin", repoUrl]);
    return;
  }

  await runGit(projectId, ["remote", "add", "origin", repoUrl]);
}

export async function commitProjectChanges(
  projectId: string,
  options: {
    includeUnstaged: boolean;
    message: string | null;
    push: boolean;
    preview?: boolean;
    generateMessage?: (context: CommitMessageContext) => Promise<string | null | undefined>;
  },
) {
  try {
    const context = await prepareCommitMessageContext(projectId, options.includeUnstaged);
    if (!context) {
      return { committed: false, message: null, previewed: false };
    }

    const generatedMessage = options.message ? null : await options.generateMessage?.(context);
    const commitMessage = options.message ?? generatedMessage ?? buildDefaultCommitMessage(context);

    if (options.preview) {
      return {
        committed: false,
        message: commitMessage,
        previewed: true,
      };
    }

    if (options.includeUnstaged) {
      await runGit(projectId, ["add", "-A"]);
    }

    await runGit(projectId, ["commit", "-m", commitMessage]);

    if (!options.push || !context.hasOrigin || !context.branch) {
      return {
        committed: true,
        message: commitMessage,
        previewed: false,
      };
    }

    try {
      await runGitWithOptions(projectId, ["push", "origin", context.branch], {
        env: getNonInteractiveGitEnv(),
        timeout: 15_000,
        maxBuffer: 1024 * 1024 * 2,
      });
    } catch (pushError) {
      try {
        await runGitWithOptions(projectId, ["push", "--set-upstream", "origin", context.branch], {
          env: getNonInteractiveGitEnv(),
          timeout: 15_000,
          maxBuffer: 1024 * 1024 * 2,
        });
      } catch {
        return {
          committed: true,
          message: commitMessage,
          previewed: false,
          pushFailed: true,
          error: `Committed locally, but push failed: ${formatGitCommandError(pushError)}`,
        };
      }
    }

    return {
      committed: true,
      message: commitMessage,
      previewed: false,
    };
  } catch (error) {
    return {
      committed: false,
      message: null,
      previewed: false,
      error: formatGitCommandError(error),
    };
  }
}
