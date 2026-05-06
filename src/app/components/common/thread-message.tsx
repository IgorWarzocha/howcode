import { memo, useEffect, useId, useRef, useState } from 'react'
import type {
  BashExecutionMessage,
  CustomThreadMessage,
  ProseMessage,
  SystemThreadMessage,
  ToolResultMessage,
} from '../../../../shared/desktop-thread-contracts'
import type { Message } from '../../types'
import { getThinkingPreview } from '../../utils/thread-previews'
import { ExpandablePanel } from './expandable-panel'
import { MarkdownContent } from './markdown-content'

type ThreadMessageProps = {
  message: Message
  autoExpandThinking?: boolean | undefined
  onToggleExpanded?: (() => void) | undefined
  firstCardOnly?: boolean | undefined
  disableInnerExpansion?: boolean | undefined
  primaryToggleAction?: (() => void) | undefined
}

function renderProse(content: string[], format: 'prose' | 'list' = 'prose') {
  if (format === 'list') {
    return (
      <MarkdownContent
        markdown={content.map((item) => `- ${item}`).join('\n')}
        className="gap-1.5 text-pretty"
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3 text-pretty [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <MarkdownContent key={paragraph} markdown={paragraph} />
      ))}
    </div>
  )
}

function renderThinking(content: string[]) {
  return (
    <div className="grid min-w-0 gap-2 [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <MarkdownContent
          key={paragraph}
          markdown={paragraph}
          tone="thinking"
          className="gap-1 text-[13px] leading-[1.62]"
        />
      ))}
    </div>
  )
}

function AssistantThinkingBlock({
  thinkingContent,
  thinkingHeaders,
  thinkingRedacted,
  autoExpandThinking = false,
  onToggleExpanded,
  interactive = true,
  primaryToggleAction,
}: {
  thinkingContent: string[]
  thinkingHeaders?: string[] | undefined
  thinkingRedacted?: boolean | undefined
  autoExpandThinking?: boolean | undefined
  onToggleExpanded?: (() => void) | undefined
  interactive?: boolean | undefined
  primaryToggleAction?: (() => void) | undefined
}) {
  const [expanded, setExpanded] = useState(autoExpandThinking)
  const previousAutoExpandRef = useRef(autoExpandThinking)
  const panelId = useId()

  useEffect(() => {
    if (autoExpandThinking) {
      setExpanded(true)
    } else if (previousAutoExpandRef.current && !autoExpandThinking) {
      setExpanded(false)
    }

    previousAutoExpandRef.current = autoExpandThinking
  }, [autoExpandThinking])

  const label =
    thinkingRedacted && thinkingContent.length === 0 ? 'Thinking unavailable' : 'Thinking'
  const preview =
    thinkingHeaders && thinkingHeaders.length > 0
      ? thinkingHeaders.join(', ')
      : getThinkingPreview(thinkingContent, thinkingRedacted)

  return (
    <ExpandablePanel
      expanded={expanded}
      onToggle={() => {
        if (primaryToggleAction) {
          primaryToggleAction()
          return
        }

        if (!interactive) {
          return
        }

        onToggleExpanded?.()
        setExpanded((current) => !current)
      }}
      panelId={panelId}
      className="mb-3 border border-[color:var(--border)] bg-[color:var(--message-tool-bg)]"
      triggerClassName="hover:bg-[color:var(--surface-hover)]"
      bodyClassName="border-[color:var(--border)]"
      interactive={interactive}
      showChevron={interactive}
      header={
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 truncate text-[12.5px] leading-[1.2] font-medium text-[color:var(--text)]/92">
            {label}
          </span>
          <span className="shrink-0 text-[11px] leading-[1.2] text-[color:var(--muted-2)]/80">
            —
          </span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] leading-[1.2] italic text-[color:var(--muted-2)]/90">
            {preview}
          </span>
        </span>
      }
    >
      {thinkingContent.length > 0 ? (
        renderThinking(thinkingContent)
      ) : (
        <div className="text-[12px] italic text-[color:var(--muted-2)]/82">
          This provider redacted the reasoning trace.
        </div>
      )}
    </ExpandablePanel>
  )
}

function SummaryBlock({ label, content }: { label: string; content: string[] }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--message-tool-bg)]">
      <div className="border-b border-[color:var(--border)] px-3 py-2 text-[12.5px] font-medium text-[color:var(--text)]/82">
        {label}
      </div>
      <div className="px-3 py-3">{renderThinking(content)}</div>
    </div>
  )
}

function UserMessageBlock({ message }: { message: ProseMessage }) {
  return (
    <div className="w-full min-w-0 rounded-2xl border border-[color:var(--accent-border)] bg-[color:var(--message-user-bg)] px-3 py-2 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_var(--accent-bg-subtle)]">
      <div className="grid min-w-0 gap-3 [overflow-wrap:anywhere]">
        {message.content.map((paragraph) => (
          <MarkdownContent
            key={paragraph}
            markdown={paragraph}
            tone="user"
            className="text-[14px] leading-[1.58]"
          />
        ))}
      </div>
    </div>
  )
}

function AssistantMessageBlock({
  autoExpandThinking,
  disableInnerExpansion,
  firstCardOnly,
  message,
  onToggleExpanded,
  primaryToggleAction,
}: Omit<ThreadMessageProps, 'message'> & { message: ProseMessage }) {
  const hasThinking = Boolean(message.thinkingContent && message.thinkingContent.length > 0)
  const showAssistantContent = message.content.length > 0 && !(firstCardOnly && hasThinking)
  return (
    <div className="min-w-0">
      {hasThinking ? (
        <AssistantThinkingBlock
          thinkingContent={message.thinkingContent ?? []}
          thinkingHeaders={message.thinkingHeaders}
          thinkingRedacted={message.thinkingRedacted}
          autoExpandThinking={autoExpandThinking}
          onToggleExpanded={onToggleExpanded}
          interactive={!disableInnerExpansion}
          primaryToggleAction={primaryToggleAction}
        />
      ) : null}
      {showAssistantContent ? (
        <div className="px-4">{renderProse(message.content, message.format)}</div>
      ) : null}
    </div>
  )
}

function ToolResultMessageBlock({ message }: { message: ToolResultMessage }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--message-tool-bg)] px-4 py-3">
      <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
        Tool · {message.toolName}
      </div>
      <div
        className={
          message.isError
            ? 'min-w-0 text-[13px] text-[color:var(--danger)]'
            : 'min-w-0 text-[13px] text-[color:var(--text)]/88'
        }
      >
        {renderProse(message.content)}
      </div>
    </div>
  )
}

function BashExecutionMessageBlock({ message }: { message: BashExecutionMessage }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--message-code-bg)] px-4 py-3 font-mono text-[12px] text-[color:var(--text)]/86">
      <div className="whitespace-pre-wrap break-all text-[color:var(--muted)]">
        $ {message.command}
      </div>
      {message.output.length > 0 ? (
        <div className="grid min-w-0 gap-1 whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
          {message.output.map((line) => (
            <p key={line} className="m-0 min-w-0">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <div className="text-[color:var(--muted)]">No output</div>
      )}
      <div className="text-[color:var(--muted)]">
        exit {message.exitCode ?? '?'}
        {message.cancelled ? ' · cancelled' : ''}
        {message.truncated ? ' · truncated' : ''}
      </div>
    </div>
  )
}

function CustomMessageBlock({ message }: { message: CustomThreadMessage }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--message-tool-bg)] px-4 py-3 text-[13px] text-[color:var(--text)]/84">
      <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
        {message.customType}
      </div>
      {renderProse(message.content)}
    </div>
  )
}

function SystemMessageBlock({ message }: { message: SystemThreadMessage }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--message-tool-bg)] px-3 py-2 text-[12.5px] italic text-[color:var(--muted)]/92">
      <div className="break-words text-[11px] not-italic uppercase tracking-[0.08em] text-[color:var(--muted-2)]/84 [overflow-wrap:anywhere]">
        {message.label}
      </div>
      {renderThinking(message.content)}
    </div>
  )
}

function ThreadMessageComponent(props: ThreadMessageProps) {
  const { message } = props
  if (message.role === 'user') return <UserMessageBlock message={message} />
  if (message.role === 'assistant') return <AssistantMessageBlock {...props} message={message} />
  if (message.role === 'toolResult') return <ToolResultMessageBlock message={message} />
  if (message.role === 'bashExecution') return <BashExecutionMessageBlock message={message} />
  if (message.role === 'custom') return <CustomMessageBlock message={message} />
  if (message.role === 'system') return <SystemMessageBlock message={message} />
  if (message.role === 'branchSummary' || message.role === 'compactionSummary') {
    return (
      <SummaryBlock
        label={message.role === 'branchSummary' ? 'Branch summary' : 'Compaction summary'}
        content={message.content}
      />
    )
  }
  return null
}
export const ThreadMessage = memo(ThreadMessageComponent)
