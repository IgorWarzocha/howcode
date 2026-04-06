import { ThreadTimeline } from "../components/workspace/thread/ThreadTimeline";
import {
  chatEmptyStateClass,
  chatHiddenViewportClass,
} from "../components/workspace/thread/thread-layout";
import type { TurnDiffSummary } from "../desktop/types";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  composerLayoutVersion: number;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function ThreadView({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  composerLayoutVersion,
  onOpenTurnDiff,
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
      turnDiffSummaries={turnDiffSummaries}
      composerLayoutVersion={composerLayoutVersion}
      onOpenTurnDiff={onOpenTurnDiff}
      onLoadEarlierMessages={() => {
        if (previousMessageCount === 0) {
          return;
        }

        onLoadEarlierMessages();
      }}
    />
  );
}
