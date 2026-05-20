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

function chooseRemoteBranch(remoteBranches: string[], branchName: string) {
  const originBranch = `origin/${branchName}`
  return remoteBranches.includes(originBranch) ? originBranch : remoteBranches[0]
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

export async function switchProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    const localBranches = await listLocalBranches(projectId)
    let checkoutArgs = localBranches.has(normalizedBranchName)
      ? ['switch', normalizedBranchName]
      : null

    if (!checkoutArgs) {
      await validateNewBranchName(projectId, normalizedBranchName)
      let remoteBranch = chooseRemoteBranch(
        await listRemoteBranches(projectId, normalizedBranchName),
        normalizedBranchName,
      )
      if (!remoteBranch) {
        await fetchRemoteBranches(projectId)
        remoteBranch = chooseRemoteBranch(
          await listRemoteBranches(projectId, normalizedBranchName),
          normalizedBranchName,
        )
      }
      checkoutArgs = remoteBranch
        ? ['switch', '--track', remoteBranch]
        : ['switch', '--create', normalizedBranchName]
    }

    await runGitWithOptions(projectId, checkoutArgs, {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true }
  } catch (error) {
    return { error: formatGitCommandError(error) }
  }
}
