import type {
  ProjectDiffBaseline,
  ProjectDiffResult,
  ProjectDiffStatsResult,
} from '../../shared/desktop-contracts.ts'
import {
  countNonEmptyLines,
  loadCommitContextOutputsForMode,
  parseShortStat,
} from './commit-message-context.ts'
import { formatGitCommandError } from './git-runner.ts'
import { resolveProjectDiffBaseline } from './project-diff-baselines.ts'
import { isGitRepository } from './project-state.ts'
import type { CommitMessageContext } from './types.ts'
import { loadWorktreeSnapshot, loadWorktreeStats } from './worktree-snapshot.ts'
export function buildDefaultCommitMessage(context: { fileCount: number }) {
  if (context.fileCount <= 0) {
    return 'Update workspace'
  }

  return context.fileCount === 1 ? 'Update 1 file' : `Update ${context.fileCount} files`
}

export async function prepareCommitMessageContext(
  projectId: string,
  includeUnstaged: boolean,
): Promise<CommitMessageContext | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  const outputs = await loadCommitContextOutputsForMode(projectId, includeUnstaged)

  const {
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  } = outputs

  const shortStat = parseShortStat(shortStatOutput)
  const fileCount = Math.max(
    countNonEmptyLines(nameStatusOutput),
    countNonEmptyLines(numStatOutput),
  )

  if (fileCount <= 0) {
    return null
  }

  return {
    projectId,
    branch,
    hasOrigin: originUrl !== null,
    includeUnstaged,
    fileCount,
    insertions: shortStat.insertions,
    deletions: shortStat.deletions,
    nameStatus: nameStatusOutput,
    diffStat: diffStatOutput,
    numStat: numStatOutput,
    patch: patchOutput,
  }
}

export async function loadProjectDiff(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
): Promise<ProjectDiffResult | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  try {
    const resolvedBaseline = await resolveProjectDiffBaseline(projectId, baseline)
    const snapshot = await loadWorktreeSnapshot(projectId, {
      baselineRev: resolvedBaseline.rev,
    })

    return {
      projectId,
      diff: snapshot.patch,
      fileCount: snapshot.fileCount,
      insertions: snapshot.insertions,
      deletions: snapshot.deletions,
      baseline: baseline ?? { kind: 'head' },
      resolvedBaseline,
    }
  } catch (error) {
    throw new Error(`Could not load worktree diff: ${formatGitCommandError(error)}`)
  }
}

export async function loadProjectDiffStats(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
): Promise<ProjectDiffStatsResult | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  try {
    const resolvedBaseline = await resolveProjectDiffBaseline(projectId, baseline)
    const stats = await loadWorktreeStats(projectId, {
      baselineRev: resolvedBaseline.rev,
    })

    return {
      projectId,
      fileCount: stats.fileCount,
      insertions: stats.insertions,
      deletions: stats.deletions,
      baseline: baseline ?? { kind: 'head' },
      resolvedBaseline,
    }
  } catch (error) {
    throw new Error(`Could not load worktree diff stats: ${formatGitCommandError(error)}`)
  }
}
