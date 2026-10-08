import { resolveDirectoryIdentity } from '../../../../desktop/directory-identity.ts'
import { runKeyedWorkspaceOperation } from '../keyed-workspace-operations.ts'

export async function withRootGitMutation<T>(
  rootDirectoryId: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const key = await resolveDirectoryIdentity(rootDirectoryId)
  return runKeyedWorkspaceOperation('root-git', key, mutation)
}
