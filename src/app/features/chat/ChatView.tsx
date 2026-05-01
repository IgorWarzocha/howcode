import { ThreadTimeline } from "../../components/workspace/thread/ThreadTimeline";
import type { Message } from "../../types";

type ChatViewProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  isCompacting: boolean;
  composerLayoutVersion: number;
  onLoadEarlierMessages: () => void;
};

export function ChatView({
  messages,
  previousMessageCount,
  isStreaming,
  isCompacting,
  composerLayoutVersion,
  onLoadEarlierMessages,
}: ChatViewProps) {
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
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return;
        }

        onLoadEarlierMessages();
      }}
    />
  );
}
