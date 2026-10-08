import path from 'node:path'
import { resolveDirectoryIdentity } from '@howaboua/howcode-sdk/node/directory-identity'
import type { WorkingDirectory } from '../../../../shared/desktop-contracts.ts'

export async function resolveDirectoryPathForComparison(directoryId: string) {
  return resolveDirectoryIdentity(directoryId)
}

export async function enrichDirectoriesWithResolvedIds(directories: WorkingDirectory[]) {
  return Promise.all(
    directories.map(async (directory) => ({
      ...directory,
      resolvedId: await resolveDirectoryPathForComparison(directory.id),
    })),
  )
}

export async function isProtectedDirectoryDeletionTarget(
  directoryId: string,
  activeDirectoryId: string,
) {
  const [resolvedDirectoryId, resolvedActiveDirectoryId] = await Promise.all([
    resolveDirectoryPathForComparison(directoryId),
    resolveDirectoryPathForComparison(activeDirectoryId),
  ])
  const relativePath = path.relative(resolvedDirectoryId, resolvedActiveDirectoryId)
  const isOutsideCandidate =
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)

  return relativePath.length === 0 || !isOutsideCandidate
}
