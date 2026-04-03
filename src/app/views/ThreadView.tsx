import { useState } from "react";
import { VirtualizedThreadTimeline } from "../components/workspace/thread/VirtualizedThreadTimeline";
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
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function ThreadView({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  onOpenTurnDiff,
  onLoadEarlierMessages,
}: ThreadViewProps) {
  const [requestedEarlierMessages, setRequestedEarlierMessages] = useState(false);

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
    <VirtualizedThreadTimeline
      messages={messages}
      previousMessageCount={previousMessageCount}
      isStreaming={isStreaming}
      turnDiffSummaries={turnDiffSummaries}
      onOpenTurnDiff={onOpenTurnDiff}
      onLoadEarlierMessages={() => {
        if (requestedEarlierMessages || previousMessageCount === 0) {
          return;
        }

        setRequestedEarlierMessages(true);
        onLoadEarlierMessages();
      }}
    />
  );
}
