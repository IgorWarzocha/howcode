import { runKeyedWorkspaceOperation } from '../runtime/keyed-workspace-operations.ts'
import { resolveWorkspaceIdentity } from '../workspace-identity.ts'

export async function withRootGitMutation<T>(
  rootProjectId: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const key = await resolveWorkspaceIdentity(rootProjectId)
  return runKeyedWorkspaceOperation('root-git', key, mutation)
}
