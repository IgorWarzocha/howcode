import { formatGitCommandError, runGitWithOptions } from './git-runner.ts'

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

async function validateNewBranchName(projectId: string, branchName: string) {
  await runGitWithOptions(projectId, ['check-ref-format', '--branch', branchName], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
}

export async function switchProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    const localBranches = await listLocalBranches(projectId)
    const checkoutArgs = localBranches.has(normalizedBranchName)
      ? ['switch', normalizedBranchName]
      : ['switch', '--create', normalizedBranchName]

    if (!localBranches.has(normalizedBranchName)) {
      await validateNewBranchName(projectId, normalizedBranchName)
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
