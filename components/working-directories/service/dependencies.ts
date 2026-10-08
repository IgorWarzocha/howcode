import type { TerminalSessionSnapshot } from '../../../shared/terminal-contracts.ts'

// Optional peers are supplied by the service composition, never imported here.
export type WorkingDirectoryPeers = {
  deleteArtifactsForConversations: (conversationIds: string[]) => void
  listTerminals: () => Promise<TerminalSessionSnapshot[]>
  closeWorkspaceTerminals: (directoryId: string) => Promise<void>
  hasActiveWorkspaceTerminal: (directoryId: string) => Promise<boolean>
}
