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

export async function switchProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
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
    return { didMutate: true }
  } catch (error) {
    return { error: formatGitCommandError(error) }
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
      return { error: 'Cannot prune the currently checked-out branch.' }
    }

    await runGitWithOptions(projectId, ['branch', '-d', normalizedBranchName], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true }
  } catch (error) {
    return { error: formatGitCommandError(error) }
  }
}
