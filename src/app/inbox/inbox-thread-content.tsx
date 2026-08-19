import { EmptyStateCard } from '../common/empty-state-card'
import { MarkdownContent } from '../common/markdown-content'
import type { InboxThread } from '../desktop/types'
import {
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeControlStrongClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeReadableClass,
  appTypeSectionTitleClass,
  inlineEmptyNoteClass,
  threadSessionStripClass,
} from '../ui/classes'
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from '../ui/layout'

export function InboxEmptyState() {
  return (
    <div className="grid h-full min-h-0 place-items-center px-6 py-6">
      <div className="w-full max-w-[520px]">
        <EmptyStateCard
          className={`grid gap-2 rounded-[18px] px-5 py-5 text-center ${appTypeGroupTextClass} ${appToneMutedClass}`}
        >
          <div className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>Inbox is waiting</div>
          <div>
            Select a thread on the left to skim Pi’s latest reply and either answer or clear it.
          </div>
        </EmptyStateCard>
      </div>
    </div>
  )
}

export function InboxThreadHeader({ thread }: { thread: InboxThread }) {
  const prompt = thread.prompt?.trim() || thread.title
  return (
    <div className="mx-auto w-full max-w-[832px]">
      <div className={`${threadSessionStripClass} gap-2 px-3.5 py-3`}>
        <div
          className={`flex min-w-0 items-center gap-2 ${appTypeMetaClass} ${appToneSubtleClass}`}
        >
          <span className="truncate">{thread.projectName}</span>
          {thread.branchName ? (
            <>
              <span aria-hidden="true">•</span>
              <span className="truncate">{thread.branchName}</span>
            </>
          ) : null}
          <span aria-hidden="true">•</span>
          <span className="shrink-0 tabular-nums">{thread.age}</span>
          {thread.running ? (
            <>
              <span aria-hidden="true">•</span>
              <span className={`shrink-0 ${appTypeControlStrongClass} text-[color:var(--accent)]`}>
                working
              </span>
            </>
          ) : null}
        </div>
        <p
          className={`m-0 max-h-[calc(1.68em*4)] overflow-y-auto whitespace-pre-wrap break-words ${appTypeReadableClass} ${appToneTextClass} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {prompt}
        </p>
      </div>
    </div>
  )
}

export function InboxThreadMessage({ thread }: { thread: InboxThread }) {
  const messageMarkdown = thread.content.join('\n\n').trim()
  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="grid h-full w-full content-start justify-items-center pb-5">
        <div className={`min-h-0 w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} text-pretty`}>
          <div className="border-t border-[color:var(--border)]/70 pt-2">
            {messageMarkdown ? (
              <MarkdownContent
                markdown={messageMarkdown}
                className={`gap-3 ${appTypeReadableClass} text-pretty`}
              />
            ) : (
              <div
                className={`grid min-h-28 place-items-center rounded-lg bg-[color:var(--folded-row-bg)] ${inlineEmptyNoteClass}`}
              >
                {thread.running ? 'Still working…' : 'No final assistant message yet.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
