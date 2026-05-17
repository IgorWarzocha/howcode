import { ThreadTimeline } from '../components/workspace/thread/thread-timeline'
import { ThreadTimelineSkeleton } from '../components/workspace/thread/thread-timeline-skeleton'
import type { Message } from '../types'

type ThreadViewProps = {
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  composerLayoutVersion: number
  composerOverlayHeight?: number
  sessionPath?: string | null | undefined
  loading?: boolean
  onLoadEarlierMessages: () => void
  onLoadAroundMessage?: ((targetHistoryCompactions: number) => void) | undefined
}

export function ThreadView({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  composerOverlayHeight = 0,
  sessionPath,
  loading = false,
  onLoadEarlierMessages,
  onLoadAroundMessage,
}: ThreadViewProps) {
  if (loading) {
    return <ThreadTimelineSkeleton composerOverlayHeight={composerOverlayHeight} />
  }

  if (messages.length === 0) {
    return <div className="h-full" />
  }

  return (
    <ThreadTimeline
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      isCompacting={isCompacting}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      sessionPath={sessionPath}
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
