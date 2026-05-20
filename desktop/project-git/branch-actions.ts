import { formatGitCommandError, runGitWithOptions } from './git-runner.ts'

export async function switchProjectBranch(projectId: string, branchName: string) {
  const normalizedBranchName = branchName.trim()
  if (!normalizedBranchName) return { error: 'Branch name is required.' }

  try {
    await runGitWithOptions(projectId, ['checkout', normalizedBranchName], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    return { didMutate: true }
  } catch (error) {
    return { error: formatGitCommandError(error) }
  }
}
