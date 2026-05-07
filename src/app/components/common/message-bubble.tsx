import { cn } from '../../utils/cn'

type MessageBubbleProps = {
  role: 'assistant' | 'user'
  content: string[]
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[color:var(--border)] px-4 py-4 shadow-[var(--shadow)]',
        role === 'user'
          ? 'ml-auto max-w-[72%] bg-[color:var(--message-user-bg)]'
          : 'max-w-[92%] bg-[color:var(--message-assistant-bg)]',
      )}
    >
      {content.map((paragraph) => (
        <p
          key={`${role}-${paragraph.slice(0, 32)}-${paragraph.length}`}
          className="mb-2.5 whitespace-normal leading-[1.7] text-[color:var(--muted)] last:mb-0"
        >
          {paragraph}
        </p>
      ))}
    </div>
  )
}
