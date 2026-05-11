import { Check, Clipboard } from 'lucide-react'
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

const copyButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)] text-[color:var(--muted)] opacity-0 shadow-[var(--shadow)] backdrop-blur-sm transition-[opacity,background-color,color,transform] delay-300 duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100 hover:delay-0 focus-visible:opacity-100 focus-visible:delay-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] active:scale-[0.96] group-hover/message:opacity-100 group-hover/message:delay-0 group-focus-within/message:opacity-100 group-focus-within/message:delay-0'

function CopyMessageButton({ label, text }: { label: string; text: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }

    const timeout = window.setTimeout(() => setCopyState('idle'), 1400)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  if (text.trim().length === 0) {
    return null
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <button
      type="button"
      className={copyButtonClass}
      onClick={(event) => {
        event.stopPropagation()
        void handleCopy()
      }}
      aria-label={copyState === 'copied' ? `Copied ${label}` : `Copy ${label}`}
      title={copyState === 'failed' ? 'Copy failed' : copyState === 'copied' ? 'Copied' : 'Copy'}
      data-no-row-toggle="true"
    >
      {copyState === 'copied' ? <Check size={13} /> : <Clipboard size={13} />}
    </button>
  )
}

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
        <div key={paragraph} className="group/message relative min-w-0 pr-9">
          <MarkdownContent
            markdown={paragraph}
            tone="thinking"
            className="gap-1 text-[13px] leading-[1.62]"
          />
          <div className="absolute top-0 right-0">
            <CopyMessageButton label="thinking paragraph" text={paragraph} />
          </div>
        </div>
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
    <div className="group/message relative w-full min-w-0 rounded-2xl border border-[color:var(--accent-border)] bg-[color:var(--message-user-bg)] px-3 py-2 pr-11 text-[14px] leading-[1.58] text-[color:var(--text)] shadow-[inset_0_1px_0_var(--accent-bg-subtle)]">
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
      <div className="absolute top-2 right-2">
        <CopyMessageButton label="user turn" text={message.content.join('\n\n')} />
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
  const statusLabel = getAssistantStatusLabel(message)
  const statusClassName = getAssistantStatusClassName(message)
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
        <div
          className={
            statusClassName
              ? `group/message relative rounded-2xl px-4 py-3 pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${statusClassName}`
              : 'group/message relative px-4 pr-12'
          }
        >
          {statusLabel ? (
            <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase opacity-85">
              {statusLabel}
            </div>
          ) : null}
          {renderProse(message.content, message.format)}
          <div className="absolute top-0 right-1">
            <CopyMessageButton label="assistant turn" text={message.content.join('\n\n')} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getAssistantStatusLabel(message: ProseMessage) {
  if (message.isError || message.stopReason === 'error') return 'Error'
  if (message.stopReason === 'length') return 'Stopped · length limit'
  if (message.stopReason === 'aborted') return 'Stopped'
  return null
}

function getAssistantStatusClassName(message: ProseMessage) {
  if (message.isError || message.stopReason === 'error') {
    return 'bg-[color:color-mix(in_srgb,var(--danger-bg)_50%,transparent)] text-[color:var(--danger)]'
  }

  if (message.stopReason === 'length') {
    return 'bg-[color:var(--warning-bg)] text-[color:var(--warning)]/50'
  }

  if (message.stopReason === 'aborted') {
    return 'bg-[color:var(--warning-bg)] text-[color:var(--warning)]/50'
  }

  return null
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
  const customStatusClassName = message.isError
    ? 'border-transparent bg-[color:color-mix(in_srgb,var(--danger-bg)_50%,transparent)] text-[color:var(--danger)]'
    : 'border-dashed border-[color:var(--border)] bg-[color:var(--message-tool-bg)] text-[color:var(--text)]/84'

  return (
    <div
      className={`grid min-w-0 gap-2 rounded-2xl border px-4 py-3 text-[13px] ${customStatusClassName}`}
    >
      <div className="break-words text-[12px] uppercase tracking-[0.08em] text-[color:var(--muted)] [overflow-wrap:anywhere]">
        {message.isError ? 'Extension error' : message.customType}
      </div>
      {renderProse(message.content)}
    </div>
  )
}

function SystemMessageBlock({ message }: { message: SystemThreadMessage }) {
  const isModelStatus = message.label === 'Model changed' || message.label === 'Reasoning changed'

  if (isModelStatus) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 px-1 text-[11.5px] text-[color:var(--muted-2)]/78">
        <span className="shrink-0 text-[10px] font-medium tracking-[0.06em] uppercase opacity-80">
          {message.label}
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] not-italic text-[color:var(--muted)]/82">
          {message.content.join('')}
        </span>
      </div>
    )
  }

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
