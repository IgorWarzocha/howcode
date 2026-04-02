import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ThreadMessage } from "../components/common/ThreadMessage";
import type { Message } from "../types";

const MESSAGE_PAGE_SIZE = 80;
const LOAD_MORE_THRESHOLD = 160;
const STICKY_BOTTOM_THRESHOLD = 24;

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
  isStreaming: boolean;
};

export function ThreadView({ messages, previousMessageCount, isStreaming }: ThreadViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingPrependHeightRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [visibleCount, setVisibleCount] = useState(MESSAGE_PAGE_SIZE);

  const visibleStartIndex = Math.max(0, messages.length - visibleCount);
  const visibleMessages = useMemo(
    () => messages.slice(visibleStartIndex),
    [messages, visibleStartIndex],
  );
  const [firstMessage, ...remainingMessages] = visibleMessages;
  const hiddenRenderedCount = Math.max(0, messages.length - visibleMessages.length);
  const hiddenCount = previousMessageCount + hiddenRenderedCount;
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

          {firstMessage ? <ThreadMessage message={firstMessage} /> : null}

          {remainingMessages.map((message) => (
            <ThreadMessage key={message.id} message={message} />
          ))}
        </div>
      </div>
    </div>
  );
}
