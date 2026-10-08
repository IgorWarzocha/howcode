import { normalizeGitBranchName } from './branch-name.ts'
import { createBranchSwitchPlan } from './branch-switch-plan.ts'
import { formatGitCommandError, getNonInteractiveGitEnv, runGitWithOptions } from './git-runner.ts'

async function listLocalBranches(directoryId: string) {
  const { stdout } = await runGitWithOptions(
    directoryId,
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

async function listRemoteBranches(directoryId: string, branchName: string) {
  const { stdout } = await runGitWithOptions(
    directoryId,
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

async function validateNewBranchName(directoryId: string, branchName: string) {
  await runGitWithOptions(directoryId, ['check-ref-format', '--branch', branchName], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
}

async function fetchRemoteBranches(directoryId: string) {
  try {
    await runGitWithOptions(directoryId, ['fetch', '--all', '--prune'], {
      env: getNonInteractiveGitEnv(),
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    })
  } catch {
    // Keep branch creation usable offline or in repos with unreachable remotes.
  }
}

async function hasDirtyWorktree(directoryId: string) {
  const { stdout } = await runGitWithOptions(directoryId, ['status', '--short'], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
  return stdout.split('\n').some((line) => line.trim().length > 0)
}

async function hasMergeInProgress(directoryId: string) {
  try {
    await runGitWithOptions(directoryId, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], {
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

export async function switchDirectoryBranch(directoryId: string, branchName: string) {
  const normalizedBranchName = normalizeGitBranchName(branchName)
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    if (await hasDirtyWorktree(directoryId)) return { error: 'Worktree is dirty. Commit first.' }

    const localBranches = await listLocalBranches(directoryId)
    let remoteBranches: string[] = []

    if (!localBranches.has(normalizedBranchName)) {
      await validateNewBranchName(directoryId, normalizedBranchName)
      remoteBranches = await listRemoteBranches(directoryId, normalizedBranchName)
      if (remoteBranches.length === 0) {
        await fetchRemoteBranches(directoryId)
        remoteBranches = await listRemoteBranches(directoryId, normalizedBranchName)
      }
    }
    const plan = createBranchSwitchPlan({
      branchName: normalizedBranchName,
      localBranches,
      remoteBranches,
    })

    await runGitWithOptions(directoryId, plan.args, {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true, branchName: normalizedBranchName }
  } catch (error) {
    return {
      ...((await hasMergeInProgress(directoryId)) ? { didMutate: true } : {}),
      error: formatGitCommandError(error),
    }
  }
}

export async function pruneDirectoryBranch(directoryId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }
  let didSwitchBranch = false

  try {
    const currentBranchResult = await runGitWithOptions(directoryId, ['branch', '--show-current'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    if (currentBranchResult.stdout.trim() === normalizedBranchName) {
      const nextBranch = chooseBranchAfterPrune(
        await listLocalBranches(directoryId),
        normalizedBranchName,
      )
      if (!nextBranch) return { error: 'No other local branch to switch to.' }
      await runGitWithOptions(directoryId, ['switch', nextBranch], {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      })
      didSwitchBranch = true
    }

    await runGitWithOptions(directoryId, ['branch', '-D', normalizedBranchName], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true }
  } catch (error) {
    const didMutate = didSwitchBranch || (await hasMergeInProgress(directoryId))
    return {
      ...(didMutate ? { didMutate: true } : {}),
      error: formatGitCommandError(error),
    }
  }
}

export async function mergeDirectoryBranch(directoryId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    if (await hasDirtyWorktree(directoryId))
      return { error: 'Parent worktree is dirty. Commit first.' }

    await runGitWithOptions(directoryId, ['merge', '--no-ff', '--no-edit', normalizedBranchName], {
      env: getNonInteractiveGitEnv(),
      timeout: 60_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return { didMutate: true }
  } catch (error) {
    return {
      ...((await hasMergeInProgress(directoryId)) ? { didMutate: true } : {}),
      error: formatGitCommandError(error),
    }
  }
}
