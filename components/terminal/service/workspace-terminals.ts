import { resolveDirectoryIdentity } from '../../../desktop/directory-identity.ts'
import { closeTerminal, listTerminals } from './runtime.ts'

async function listWorkspaceTerminals(directoryId: string) {
  const directoryIdentity = await resolveDirectoryIdentity(directoryId)
  const snapshots = await listTerminals()
  const matchingSnapshots = await Promise.all(
    snapshots.map(async (snapshot) =>
      (await resolveDirectoryIdentity(snapshot.directoryId)) === directoryIdentity
        ? snapshot
        : null,
    ),
  )
  return matchingSnapshots.filter((snapshot) => snapshot !== null)
}

export async function hasActiveWorkspaceTerminal(directoryId: string) {
  const snapshots = await listWorkspaceTerminals(directoryId)
  return snapshots.some(
    (snapshot) => snapshot.status === 'starting' || snapshot.status === 'running',
  )
}

export async function closeWorkspaceTerminals(directoryId: string) {
  const snapshots = await listWorkspaceTerminals(directoryId)
  await Promise.all(
    snapshots.map((snapshot) =>
      closeTerminal({ sessionId: snapshot.sessionId, deleteHistory: true }),
    ),
  )
}
