import {
  thinkingDisclosureBodyClass,
  thinkingDisclosureClass,
  thinkingDisclosureTriggerClass,
  threadSessionErrorStripClass,
  threadSessionStripClass,
  threadSessionSurfaceClass,
  threadUserMessageClass,
} from '@howcode/ui'
import { memo, useEffect, useId, useRef, useState } from 'react'
import type {
  CustomThreadMessage,
  ProseMessage,
  SystemThreadMessage,
} from '../../../../shared/desktop-thread-contracts'
import type { Message } from '../../types'
import { getThinkingPreview } from '../../utils/thread-previews'
import { ExpandablePanel } from './expandable-panel'
import { MarkdownContent } from './markdown-content'
import { CopyMessageButton, renderProse, renderThinking } from './thread-message-utils'
import { useThreadFindHighlight } from './useThreadFindHighlight'

type ThreadMessageProps = {
  message: Message
  autoExpandThinking?: boolean | undefined
  findQuery?: string | undefined
  findActive?: boolean | undefined
  onToggleExpanded?: (() => void) | undefined
  firstCardOnly?: boolean | undefined
  disableInnerExpansion?: boolean | undefined
  primaryToggleAction?: (() => void) | undefined
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
      className={thinkingDisclosureClass}
      triggerClassName={thinkingDisclosureTriggerClass}
      bodyClassName={thinkingDisclosureBodyClass}
      interactive={interactive}
      showChevron={interactive}
      header={
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 truncate text-[12.5px] leading-[1.2] font-medium text-[color:var(--muted)]/92">
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
        <div data-no-find-highlight="true">{renderThinking(thinkingContent)}</div>
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
    <div className={`w-full overflow-hidden ${threadSessionStripClass}`}>
      <div className="text-[12.5px] font-medium text-[color:var(--muted)]/92">{label}</div>
      <div>{renderThinking(content)}</div>
    </div>
  )
}

function UserMessageBlock({ message }: { message: ProseMessage }) {
  return (
    <div
      className={`group/message relative w-full min-w-0 border px-3 py-2 pr-11 text-[14px] leading-[1.58] text-[color:var(--text)] ${threadUserMessageClass}`}
    >
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
              ? `${threadSessionSurfaceClass} group/message relative px-4 py-3 pr-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${statusClassName}`
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

function CustomMessageBlock({ message }: { message: CustomThreadMessage }) {
  return (
    <div className={message.isError ? threadSessionErrorStripClass : threadSessionStripClass}>
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
    <div className={`${threadSessionStripClass} text-[12.5px] italic text-[color:var(--muted)]/92`}>
      <div className="break-words text-[11px] not-italic uppercase tracking-[0.08em] text-[color:var(--muted-2)]/84 [overflow-wrap:anywhere]">
        {message.label}
      </div>
      {renderThinking(message.content)}
    </div>
  )
}

function renderThreadMessageContent(props: ThreadMessageProps) {
  const { message } = props
  if (message.role === 'user') return <UserMessageBlock message={message} />
  if (message.role === 'assistant') return <AssistantMessageBlock {...props} message={message} />
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

function ThreadMessageComponent(props: ThreadMessageProps) {
  const highlightRootRef = useRef<HTMLDivElement | null>(null)
  useThreadFindHighlight({
    active: props.findActive,
    query: props.findQuery,
    rootRef: highlightRootRef,
  })

  return <div ref={highlightRootRef}>{renderThreadMessageContent(props)}</div>
}

export const ThreadMessage = memo(ThreadMessageComponent)
