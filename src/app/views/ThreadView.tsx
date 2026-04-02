import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ThreadMessage } from "../components/common/ThreadMessage";
import { ChangedFilesTree } from "../components/workspace/diff/ChangedFilesTree";
import type { TurnDiffSummary } from "../desktop/types";
import type { Message } from "../types";

const MESSAGE_PAGE_SIZE = 80;
const LOAD_MORE_THRESHOLD = 160;
const STICKY_BOTTOM_THRESHOLD = 24;

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
  void isStreaming;
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingPrependHeightRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [visibleCount, setVisibleCount] = useState(MESSAGE_PAGE_SIZE);
  const [expandedDiffTrees, setExpandedDiffTrees] = useState<Record<number, boolean>>({});

  const visibleStartIndex = Math.max(0, messages.length - visibleCount);
  const visibleMessages = useMemo(
    () => messages.slice(visibleStartIndex),
    [messages, visibleStartIndex],
  );
  const [firstMessage, ...remainingMessages] = visibleMessages;
  const hiddenRenderedCount = Math.max(0, messages.length - visibleMessages.length);
  const hiddenCount = previousMessageCount + hiddenRenderedCount;
  const turnDiffSummaryByAssistantMessageId = useMemo(
    () =>
      new Map(
        turnDiffSummaries
          .filter((summary) => summary.assistantMessageId)
          .map((summary) => [summary.assistantMessageId as string, summary]),
      ),
    [turnDiffSummaries],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (pendingPrependHeightRef.current !== null) {
      const previousHeight = pendingPrependHeightRef.current;
      pendingPrependHeightRef.current = null;
      container.scrollTop += container.scrollHeight - previousHeight;
      return;
    }

    if (shouldStickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  });

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD;

    if (
      container.scrollTop <= LOAD_MORE_THRESHOLD &&
      visibleMessages.length < messages.length &&
      pendingPrependHeightRef.current === null
    ) {
      pendingPrependHeightRef.current = container.scrollHeight;
      setVisibleCount((current) => Math.min(messages.length, current + MESSAGE_PAGE_SIZE));
    }
  };

  const renderMessageRow = (message: Message) => {
    const turnSummary =
      message.role === "assistant"
        ? turnDiffSummaryByAssistantMessageId.get(message.id)
        : undefined;
    const allDirectoriesExpanded =
      turnSummary && expandedDiffTrees[turnSummary.checkpointTurnCount] !== false;

    return (
      <Fragment key={message.id}>
        <ThreadMessage message={message} />
        {turnSummary && turnSummary.files.length > 0 ? (
          <div className="px-4">
            <div className="rounded-[16px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.025)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  Changed files ({turnSummary.files.length}) · turn{" "}
                  {turnSummary.checkpointTurnCount}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-[9px] border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                    onClick={() =>
                      setExpandedDiffTrees((current) => ({
                        ...current,
                        [turnSummary.checkpointTurnCount]: !allDirectoriesExpanded,
                      }))
                    }
                  >
                    {allDirectoriesExpanded ? "Collapse all" : "Expand all"}
                  </button>
                  <button
                    type="button"
                    className="rounded-[9px] border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                    onClick={() =>
                      onOpenTurnDiff(turnSummary.checkpointTurnCount, turnSummary.files[0]?.path)
                    }
                  >
                    View diff
                  </button>
                </div>
              </div>
              <ChangedFilesTree
                checkpointTurnCount={turnSummary.checkpointTurnCount}
                files={turnSummary.files}
                allDirectoriesExpanded={Boolean(allDirectoriesExpanded)}
                onOpenTurnDiff={onOpenTurnDiff}
              />
            </div>
          </div>
        ) : null}
      </Fragment>
    );
  };

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
    <div className="mx-auto flex h-full w-full max-w-[744px] overflow-hidden">
      <div
        ref={containerRef}
        className="min-h-0 w-full overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable]"
        onScroll={handleScroll}
      >
        <div className="grid gap-4.5 px-4 pt-4 pb-8 [&>*]:min-w-0">
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="mx-4 flex items-center gap-4 py-1 text-[13px] text-[color:var(--muted-2)]"
              onClick={() => {
                const container = containerRef.current;
                if (container) {
                  pendingPrependHeightRef.current = container.scrollHeight;
                }
                setVisibleCount((current) =>
                  Math.min(messages.length, current + MESSAGE_PAGE_SIZE),
                );
              }}
            >
              <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
              <span>{hiddenCount} earlier messages</span>
              <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
            </button>
          ) : null}

          {firstMessage ? renderMessageRow(firstMessage) : null}

          {remainingMessages.map((message) => renderMessageRow(message))}
        </div>
      </div>
    </div>
  );
}
