import type {
  ChatRendererProps,
  ConversationRendererPort,
} from '@howaboua/howcode-sdk/chat-renderer'
import { useContext } from 'react'
import { openExternalQuery, searchChatQuery } from '../query/desktop-query'
import { InstalledConversationContent } from './conversation-contributions'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'
import { TurnAttachments } from './turn-attachments'

const conversationRenderer: ConversationRendererPort = {
  searchChat: searchChatQuery,
  openExternal: openExternalQuery,
  TurnAttachments,
  ConversationContent: InstalledConversationContent,
}

export function InstalledChatRenderer(
  props: Omit<ChatRendererProps, 'host' | 'conversationRenderer'>,
) {
  const renderers = useContext(RendererHostsContext)
  const renderer = renderers.find(({ contribution }) => contribution.ChatRenderer)
  if (!renderer) return null
  const Content = renderer.contribution.ChatRenderer
  return Content ? (
    <RendererSlot name={renderer.name}>
      <Content {...props} host={renderer.host} conversationRenderer={conversationRenderer} />
    </RendererSlot>
  ) : null
}
