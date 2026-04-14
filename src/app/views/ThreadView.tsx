import { ThreadTimeline } from "../components/workspace/thread/ThreadTimeline";
import {
  chatEmptyStateClass,
  chatHiddenViewportClass,
} from "../components/workspace/thread/thread-layout";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  composerLayoutVersion: number;
  bottomInset: number;
  onLoadEarlierMessages: () => void;
};

export function ThreadView({
  messages,
  previousMessageCount,
  isStreaming,
  composerLayoutVersion,
  bottomInset,
  onLoadEarlierMessages,
}: ThreadViewProps) {
  if (messages.length === 0) {
    return (
      <div className={chatHiddenViewportClass}>
        <div className={chatEmptyStateClass}>
          <div className="grid place-items-center">No messages yet.</div>
        </div>
      </div>
    );
  }

  return (
    <ThreadTimeline
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      composerLayoutVersion={composerLayoutVersion}
      bottomInset={bottomInset}
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return;
        }

        onLoadEarlierMessages();
      }}
    />
  );
}
