import { MessageBubble } from "../components/common/MessageBubble";
import type { Message } from "../types";

type ThreadViewProps = {
  messages: Message[];
};

export function ThreadView({ messages }: ThreadViewProps) {
  const [firstMessage, ...remainingMessages] = messages;

  return (
    <div className="w-full max-w-[880px] self-stretch">
      <div className="grid gap-3.5">
        {firstMessage ? (
          <MessageBubble role={firstMessage.role} content={firstMessage.content} />
        ) : null}

        {remainingMessages.length > 0 ? (
          <div className="flex items-center gap-4 py-2 text-sm text-[color:var(--muted-2)]">
            <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
            <span>{remainingMessages.length} previous messages</span>
            <div className="h-px flex-1 bg-[rgba(161,173,221,0.12)]" />
          </div>
        ) : null}

        {remainingMessages.map((message) => (
          <MessageBubble key={message.id} role={message.role} content={message.content} />
        ))}
      </div>
    </div>
  );
}
