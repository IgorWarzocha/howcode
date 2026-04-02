import { VirtualizedThreadTimeline } from "../components/workspace/thread/VirtualizedThreadTimeline";
import type { TurnDiffSummary } from "../desktop/types";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
};

export function ThreadView({
  messages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
  onOpenTurnDiff,
}: ThreadViewProps) {
  if (messages.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[744px] overflow-hidden">
        <div className="min-h-0 w-full overflow-y-scroll overflow-x-hidden px-4 pt-16 text-[color:var(--muted)] [scrollbar-gutter:stable]">
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
    />
  );
}
