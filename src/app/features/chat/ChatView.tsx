import { ThreadTimeline } from "../../components/workspace/thread/ThreadTimeline";
import {
  chatEmptyStateClass,
  chatHiddenViewportClass,
} from "../../components/workspace/thread/thread-layout";
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
    return (
      <div className={chatHiddenViewportClass}>
        <div className={chatEmptyStateClass}>
          <div className="grid max-w-[460px] gap-2 text-center">
            <h1 className="m-0 text-[20px] font-medium text-[color:var(--text)]">Start a chat</h1>
            <p className="m-0 text-[13px] text-[color:var(--muted)]">
              Ask a question or kick off a lightweight conversation. Enter sends, Shift+Enter adds a
              new line.
            </p>
          </div>
        </div>
      </div>
    );
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
