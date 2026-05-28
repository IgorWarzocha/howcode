import { normalizeGitBranchName } from './branch-name.ts'
import { createBranchSwitchPlan } from './branch-switch-plan.ts'
import { formatGitCommandError, getNonInteractiveGitEnv, runGitWithOptions } from './git-runner.ts'

async function listLocalBranches(projectId: string) {
  const { stdout } = await runGitWithOptions(
    projectId,
    ['branch', '--format=%(refname:short)', '--sort=-committerdate'],
    {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    },
  )
  return new Set(
    stdout
      .split('\n')
      .map((branch) => branch.trim())
      .filter((branch) => branch.length > 0),
  )
}

async function listRemoteBranches(projectId: string, branchName: string) {
  const { stdout } = await runGitWithOptions(
    projectId,
    ['branch', '--remotes', '--format=%(refname:short)', '--list', `*/${branchName}`],
    {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    },
  )
  return stdout
    .split('\n')
    .map((branch) => branch.trim())
    .filter((branch) => branch.length > 0 && !branch.endsWith('/HEAD'))
}

async function validateNewBranchName(projectId: string, branchName: string) {
  await runGitWithOptions(projectId, ['check-ref-format', '--branch', branchName], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
}

async function fetchRemoteBranches(projectId: string) {
  try {
    await runGitWithOptions(projectId, ['fetch', '--all', '--prune'], {
      env: getNonInteractiveGitEnv(),
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    })
  } catch {
    // Keep branch creation usable offline or in repos with unreachable remotes.
  }
}

async function hasDirtyWorktree(projectId: string) {
  const { stdout } = await runGitWithOptions(projectId, ['status', '--short'], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
  return stdout.split('\n').some((line) => line.trim().length > 0)
}

async function hasMergeInProgress(projectId: string) {
  try {
    await runGitWithOptions(projectId, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return true
  } catch {
    return false
  }
}

function chooseBranchAfterPrune(branches: Set<string>, branchName: string) {
  for (const candidate of ['main', 'master', 'develop', 'dev']) {
    if (candidate !== branchName && branches.has(candidate)) return candidate
  }
  return [...branches].find((candidate) => candidate !== branchName) ?? null
}

export async function switchProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = normalizeGitBranchName(branchName)
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    if (await hasDirtyWorktree(projectId)) return { error: 'Worktree is dirty. Commit first.' }

    const localBranches = await listLocalBranches(projectId)
    let remoteBranches: string[] = []

    if (!localBranches.has(normalizedBranchName)) {
      await validateNewBranchName(projectId, normalizedBranchName)
      remoteBranches = await listRemoteBranches(projectId, normalizedBranchName)
      if (remoteBranches.length === 0) {
        await fetchRemoteBranches(projectId)
        remoteBranches = await listRemoteBranches(projectId, normalizedBranchName)
      }
    }
    const plan = createBranchSwitchPlan({
      branchName: normalizedBranchName,
      localBranches,
      remoteBranches,
    })

    await runGitWithOptions(projectId, plan.args, {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true, branchName: normalizedBranchName }
  } catch (error) {
    return {
      ...((await hasMergeInProgress(projectId)) ? { didMutate: true } : {}),
      error: formatGitCommandError(error),
    }
  }
}

export async function pruneProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    const currentBranchResult = await runGitWithOptions(projectId, ['branch', '--show-current'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    if (currentBranchResult.stdout.trim() === normalizedBranchName) {
      const nextBranch = chooseBranchAfterPrune(
        await listLocalBranches(projectId),
        normalizedBranchName,
      )
      if (!nextBranch) return { error: 'No other local branch to switch to.' }
      await runGitWithOptions(projectId, ['switch', nextBranch], {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      })
    }

    await runGitWithOptions(projectId, ['branch', '-D', normalizedBranchName], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true }
  } catch (error) {
    return {
      ...((await hasMergeInProgress(projectId)) ? { didMutate: true } : {}),
      error: formatGitCommandError(error),
    }
  }
}

export async function mergeProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    if (await hasDirtyWorktree(projectId))
      return { error: 'Parent worktree is dirty. Commit first.' }

    await runGitWithOptions(projectId, ['merge', '--no-ff', '--no-edit', normalizedBranchName], {
      env: getNonInteractiveGitEnv(),
      timeout: 60_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return { didMutate: true }
  } catch (error) {
    return { error: formatGitCommandError(error) }
  }
}
