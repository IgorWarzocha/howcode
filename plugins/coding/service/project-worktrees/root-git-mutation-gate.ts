import { resolveWorkspaceIdentity } from '../../../../desktop/workspace-identity.ts'
import { runKeyedWorkspaceOperation } from '../keyed-workspace-operations.ts'

export async function withRootGitMutation<T>(
  rootProjectId: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const key = await resolveWorkspaceIdentity(rootProjectId)
  return runKeyedWorkspaceOperation('root-git', key, mutation)
}
