import { ThreadMessage } from "../components/common/ThreadMessage";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
  previousMessageCount: number;
};

export function ThreadView({ messages, previousMessageCount }: ThreadViewProps) {
  const [firstMessage, ...remainingMessages] = messages;

  return (
    <div className="mx-auto w-full max-w-[910px] self-stretch pt-1">
      <div className="grid gap-5 px-[14px] pb-6">
        {firstMessage ? (
          <ThreadMessage
            role={firstMessage.role}
            format={firstMessage.format}
            content={firstMessage.content}
          />
        ) : null}

        {remainingMessages.length > 0 ? (
          <div className="flex items-center gap-4 py-2 text-sm text-[color:var(--muted-2)]">
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
