import type { InboxChat } from '../desktop/types'

export function getInboxChatComposerProfile(
  chat: Pick<InboxChat, 'composerProfile'> | null | undefined,
): 'general' | 'coding' {
  return chat?.composerProfile ?? 'coding'
}
