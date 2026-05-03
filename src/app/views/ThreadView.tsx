import { ThreadTimeline } from "../components/workspace/thread/ThreadTimeline";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  isCompacting: boolean;
  composerLayoutVersion: number;
  composerOverlayHeight?: number;
  onLoadEarlierMessages: () => void;
};

export function ThreadView({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  composerOverlayHeight = 0,
  onLoadEarlierMessages,
}: ThreadViewProps) {
  if (messages.length === 0) {
    return <div className="h-full" />;
  }

  return (
    <ThreadTimeline
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      isCompacting={isCompacting}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return;
        }

        onLoadEarlierMessages();
      }}
    />
  );
}
