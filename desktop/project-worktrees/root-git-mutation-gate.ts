import { resolveWorkspaceIdentity } from '../workspace-identity.ts'

const pendingRootMutations = new Map<string, Promise<void>>()

export async function withRootGitMutation<T>(
  rootProjectId: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const key = await resolveWorkspaceIdentity(rootProjectId)
  const precedingMutation = pendingRootMutations.get(key) ?? Promise.resolve()
  let releaseMutation: (() => void) | undefined
  const currentMutation = new Promise<void>((resolve) => {
    releaseMutation = resolve
  })
  pendingRootMutations.set(key, currentMutation)

  await precedingMutation
  try {
    return await mutation()
  } finally {
    releaseMutation?.()
    if (pendingRootMutations.get(key) === currentMutation) pendingRootMutations.delete(key)
  }
}
