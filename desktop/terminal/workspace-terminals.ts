import { resolveWorkspaceIdentity } from '../workspace-identity.ts'
import { closeTerminal, listTerminals } from './runtime.ts'

async function listWorkspaceTerminals(projectId: string) {
  const projectIdentity = await resolveWorkspaceIdentity(projectId)
  const snapshots = await listTerminals()
  const matchingSnapshots = await Promise.all(
    snapshots.map(async (snapshot) =>
      (await resolveWorkspaceIdentity(snapshot.projectId)) === projectIdentity ? snapshot : null,
    ),
  )
  return matchingSnapshots.filter((snapshot) => snapshot !== null)
}

export async function hasActiveWorkspaceTerminal(projectId: string) {
  const snapshots = await listWorkspaceTerminals(projectId)
  return snapshots.some(
    (snapshot) => snapshot.status === 'starting' || snapshot.status === 'running',
  )
}

export async function closeWorkspaceTerminals(projectId: string) {
  const snapshots = await listWorkspaceTerminals(projectId)
  await Promise.all(
    snapshots.map((snapshot) =>
      closeTerminal({ sessionId: snapshot.sessionId, deleteHistory: true }),
    ),
  )
}
