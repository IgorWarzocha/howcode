import { buildDefaultCommitMessage, prepareCommitMessageContext } from './commit-context.ts'
import { getOriginUrl, isGitRepository } from './directory-state.ts'
import {
  formatGitCommandError,
  getNonInteractiveGitEnv,
  runGit,
  runGitWithOptions,
} from './git-runner.ts'
import type { CommitMessageContext } from './types.ts'

export async function initializeDirectoryGit(directoryId: string) {
  if (await isGitRepository(directoryId)) {
    return
  }

  await runGit(directoryId, ['init'])
}

export async function setDirectoryOrigin(directoryId: string, repoUrl: string) {
  if (!(await isGitRepository(directoryId))) {
    return
  }

  const currentOriginUrl = await getOriginUrl(directoryId)

  if (currentOriginUrl) {
    await runGit(directoryId, ['remote', 'set-url', 'origin', repoUrl])
    return
  }

  await runGit(directoryId, ['remote', 'add', 'origin', repoUrl])
}

export async function commitDirectoryChanges(
  directoryId: string,
  options: {
    includeUnstaged: boolean
    includeUntracked?: boolean | undefined
    message: string | null
    push: boolean
    preview?: boolean | undefined
    generateMessage?: (context: CommitMessageContext) => Promise<string | null | undefined>
  },
) {
  try {
    const context = await prepareCommitMessageContext(
      directoryId,
      options.includeUnstaged,
      options.includeUntracked ?? false,
    )
    if (!context) {
      return { committed: false, message: null, previewed: false, pushed: false }
    }

    const generatedMessage = options.message ? null : await options.generateMessage?.(context)
    const commitMessage = options.message ?? generatedMessage ?? buildDefaultCommitMessage(context)

    if (options.preview) {
      return {
        committed: false,
        message: commitMessage,
        previewed: true,
        pushed: false,
      }
    }

    if (options.includeUnstaged) {
      await runGit(directoryId, ['add', options.includeUntracked ? '-A' : '-u'])
    }

    await runGit(directoryId, ['commit', '-m', commitMessage])

    if (!(options.push && context.hasOrigin && context.branch)) {
      return {
        committed: true,
        message: commitMessage,
        previewed: false,
        pushed: false,
      }
    }

    try {
      await runGitWithOptions(directoryId, ['push', 'origin', context.branch], {
        env: getNonInteractiveGitEnv(),
        timeout: 15_000,
        maxBuffer: 1024 * 1024 * 2,
      })
    } catch (pushError) {
      try {
        await runGitWithOptions(directoryId, ['push', '--set-upstream', 'origin', context.branch], {
          env: getNonInteractiveGitEnv(),
          timeout: 15_000,
          maxBuffer: 1024 * 1024 * 2,
        })
      } catch {
        return {
          committed: true,
          message: commitMessage,
          previewed: false,
          pushed: false,
          pushFailed: true,
          error: `Committed locally, but push failed: ${formatGitCommandError(pushError)}`,
        }
      }
    }

    return {
      committed: true,
      message: commitMessage,
      previewed: false,
      pushed: true,
    }
  } catch (error) {
    return {
      committed: false,
      message: null,
      previewed: false,
      pushed: false,
      error: formatGitCommandError(error),
    }
  }
}
