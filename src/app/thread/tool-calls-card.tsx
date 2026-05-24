import {
  appToneDangerClass,
  appToneSubtleClass,
  appTypeCodeClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeMetaStrongClass,
  appTypeSmallClass,
  appTypeTinyStrongClass,
  processLedgerClass,
  processLedgerDetailBlockClass,
  processLedgerRowClass,
  processLedgerRowExpandedClass,
  threadSessionSurfaceClass,
} from '@howcode/ui'
import { useState } from 'react'
import { ExpandablePanel } from '../common/expandable-panel'
import type { Message } from '../types'
import { cn } from '../utils/cn'
import { getToolCallPreview, getToolCallTitle } from '../utils/thread-previews'

type ToolCallMessage = Extract<Message, { role: 'toolResult' | 'bashExecution' }>

type ToolCallsCardProps = {
  id: string
  messages: ToolCallMessage[]
  expanded: boolean
  forceExpanded?: boolean
  onToggleGroupExpanded?: () => void
  onToggleToolCallExpanded?: () => void
}

function renderToolCallBody(message: ToolCallMessage) {
  if (message.role === 'toolResult') {
    return (
      <div
        className={
          message.isError
            ? `grid min-w-0 gap-2 ${appTypeGroupTextClass} ${appToneDangerClass}`
            : `grid min-w-0 gap-2 ${appTypeGroupTextClass} ${appToneSubtleClass}`
        }
      >
        {message.args ? (
          <div className={processLedgerDetailBlockClass}>
            <div
              className={`${appTypeTinyStrongClass} tracking-[0.08em] text-[color:var(--muted-2)]/70 uppercase`}
            >
              Arguments
            </div>
            <pre className="m-0 max-h-44 overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.args}
            </pre>
          </div>
        ) : null}
        {message.content.map((paragraph) => (
          <p
            key={paragraph}
            className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            {paragraph}
          </p>
        ))}
        {message.images && message.images.length > 0 ? (
          <div className="grid min-w-0 gap-2">
            {message.images.map((image) => (
              <img
                key={image.src}
                src={image.src}
                alt={image.alt}
                className="max-h-[420px] max-w-full rounded-lg border border-[rgba(169,178,215,0.12)] bg-[rgba(255,255,255,0.03)] object-contain"
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`grid min-w-0 gap-2 ${appTypeCodeClass} text-[color:var(--muted-2)]/84`}>
      <div className="whitespace-pre-wrap break-all text-[color:var(--muted-2)]/88">
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
        <div className="text-[color:var(--muted-2)]/80">No output</div>
      )}
      <div className="text-[color:var(--muted-2)]/80">
        exit {message.exitCode ?? '?'}
        {message.cancelled ? ' · cancelled' : ''}
        {message.truncated ? ' · truncated' : ''}
      </div>
    </div>
  )
}

export function ToolCallsCard({
  id,
  messages,
  expanded,
  forceExpanded = false,
  onToggleGroupExpanded,
  onToggleToolCallExpanded,
}: ToolCallsCardProps) {
  const [expandedToolCallIds, setExpandedToolCallIds] = useState<Record<string, boolean>>({})

  return (
    <ExpandablePanel
      expanded={expanded}
      onToggle={() => {
        if (forceExpanded) {
          return
        }

        onToggleGroupExpanded?.()
      }}
      panelId={`tool-call-group-${id}`}
      wrapperClassName="min-w-0 max-w-full overflow-hidden rounded-lg"
      className="bg-transparent"
      triggerClassName={`${threadSessionSurfaceClass} px-2 py-1.5 hover:bg-[color:var(--surface-hover)]`}
      bodyClassName="!border-0 min-w-0 max-w-full overflow-hidden px-0 py-1"
      header={
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden">
          <span className={`truncate ${appTypeMetaStrongClass} text-[color:var(--muted)]/90`}>
            Tool calls ({messages.length})
          </span>
        </span>
      }
    >
      <div className={processLedgerClass}>
        {messages.map((message, index) => {
          const messageKey = `${message.id}:${index}`
          const toolCallExpanded = expandedToolCallIds[messageKey] ?? false
          const title = getToolCallTitle(message)
          const preview = getToolCallPreview(message)
          const isError = message.role === 'toolResult' && message.isError
          const isRunning = message.role === 'toolResult' && message.running

          return (
            <ExpandablePanel
              key={messageKey}
              expanded={toolCallExpanded}
              onToggle={() => {
                onToggleToolCallExpanded?.()
                setExpandedToolCallIds((current) => ({
                  ...current,
                  [messageKey]: !toolCallExpanded,
                }))
              }}
              panelId={`tool-call-panel-${messageKey}`}
              wrapperClassName="min-w-0 max-w-full overflow-hidden rounded-lg"
              className="bg-transparent"
              triggerClassName={cn(processLedgerRowClass, isError && 'text-[color:var(--danger)]')}
              bodyClassName="!border-0 min-w-0 max-w-full overflow-hidden px-0 py-0"
              showChevron={false}
              header={
                <>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                    <span
                      className={cn(
                        `${appTypeSmallClass} shrink-0 truncate`,
                        isError
                          ? 'text-[color:var(--danger)]'
                          : isRunning
                            ? 'text-[color:var(--accent)]'
                            : 'text-[color:var(--muted)]/92',
                      )}
                    >
                      {title}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate ${appTypeMetaClass} text-[color:var(--muted-2)]/82`}
                    >
                      {preview}
                    </span>
                  </span>
                  {isError ? (
                    <span className={`shrink-0 ${appTypeTinyStrongClass} ${appToneDangerClass}`}>
                      Error
                    </span>
                  ) : null}
                  {isRunning ? (
                    <span
                      className={`shrink-0 ${appTypeTinyStrongClass} text-[color:var(--accent)]`}
                    >
                      Running
                    </span>
                  ) : null}
                </>
              }
            >
              <div className={processLedgerRowExpandedClass}>{renderToolCallBody(message)}</div>
            </ExpandablePanel>
          )
        })}
      </div>
    </ExpandablePanel>
  )
}
