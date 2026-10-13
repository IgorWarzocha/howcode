// Optional peers are supplied by the service composition, never imported here.
import type { SidebarMaintenance } from '@howaboua/howcode-classic-navigation/host-contribution'

export type { SidebarMaintenance } from '@howaboua/howcode-classic-navigation/host-contribution'
export type WorkingDirectoryPeers = {
  sidebar?: SidebarMaintenance | undefined
  deleteConversations: (conversationIds: readonly string[]) => Promise<void>
  listTerminals: () => Promise<readonly { directoryId: string; status: string }[]>
  closeWorkspaceTerminals: (directoryId: string) => Promise<void>
  hasActiveWorkspaceTerminal: (directoryId: string) => Promise<boolean>
}
