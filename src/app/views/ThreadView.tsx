import { ThreadMessage } from "../components/common/ThreadMessage";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
};

export function ThreadView({ messages, previousMessageCount }: ThreadViewProps) {
  const [firstMessage, ...remainingMessages] = messages;

  if (messages.length === 0) {
    return (
      <div className="mx-auto grid w-full max-w-[744px] self-stretch place-items-center px-4 pt-16 text-[color:var(--muted)]">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[744px] self-stretch pt-4">
      <div className="grid gap-4.5 px-4 pb-2">
        {firstMessage ? (
          <ThreadMessage
            role={firstMessage.role}
            format={firstMessage.format}
            content={firstMessage.content}
          />
        ) : null}

        {remainingMessages.length > 0 && previousMessageCount > 0 ? (
          <div className="flex items-center gap-4 py-1 text-[13px] text-[color:var(--muted-2)]">
            <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
            <span>{previousMessageCount} previous messages</span>
            <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
          </div>
        ) : null}

        {remainingMessages.map((message) => (
          <ThreadMessage
            key={message.id}
            role={message.role}
            format={message.format}
            content={message.content}
          />
        ))}
      </div>
    </div>
  );
}
