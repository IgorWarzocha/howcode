import { stat } from 'node:fs/promises'
import { resolveWorkspaceIdentity } from '../workspace-identity.ts'
import { runGitWithOptions } from './git-runner.ts'

export type GitRepositoryIdentity = {
  commonDirectoryIdentity: string | null
  topLevelIdentity: string
}

export async function loadGitRepositoryIdentity(projectId: string): Promise<GitRepositoryIdentity> {
  const { stdout } = await runGitWithOptions(
    projectId,
    ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'],
    { timeout: 10_000, maxBuffer: 1024 * 128 },
  )
  const paths = stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
  const [topLevelPath, commonDirectoryPath] = paths
  if (!(topLevelPath && commonDirectoryPath && paths.length === 2)) {
    throw new Error('Git returned an invalid repository identity.')
  }

  const [topLevelIdentity, commonDirectoryMetadata] = await Promise.all([
    resolveWorkspaceIdentity(topLevelPath),
    stat(commonDirectoryPath, { bigint: true }),
  ])
  return {
    topLevelIdentity,
    commonDirectoryIdentity:
      commonDirectoryMetadata.isDirectory() && commonDirectoryMetadata.ino !== 0n
        ? [
            'git-common-dir-v1',
            commonDirectoryMetadata.dev,
            commonDirectoryMetadata.ino,
            commonDirectoryMetadata.birthtimeNs,
          ].join(':')
        : null,
  }
}

export async function captureGitRepositoryIdentity(projectId: string) {
  try {
    return await loadGitRepositoryIdentity(projectId)
  } catch {
    return null
  }
}

export async function captureGitCommonDirectoryIdentity(projectId: string) {
  return (await captureGitRepositoryIdentity(projectId))?.commonDirectoryIdentity ?? null
}
