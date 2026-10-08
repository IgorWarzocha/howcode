import type { Message } from '../types'
import { ChatTimeline } from './chat-timeline'
import { ChatTimelineSkeleton } from './chat-timeline-skeleton'

export type ChatViewProps = {
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  composerLayoutVersion: number
  composerOverlayHeight?: number
  conversationId?: string | null | undefined
  loading?: boolean
  onLoadEarlierMessages: () => void
  onLoadAroundMessage?: ((targetHistoryCompactions: number) => void) | undefined
}

export function ChatView({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  composerOverlayHeight = 0,
  conversationId,
  loading = false,
  onLoadEarlierMessages,
  onLoadAroundMessage,
}: ChatViewProps) {
  if (loading) {
    return <ChatTimelineSkeleton composerOverlayHeight={composerOverlayHeight} />
  }

  if (messages.length === 0) {
    return <div className="h-full" />
  }

  return (
    <ChatTimeline
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      isCompacting={isCompacting}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      conversationId={conversationId}
      onLoadAroundMessage={onLoadAroundMessage}
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return
        }

        onLoadEarlierMessages()
      }}
    />
  )
}
