import { EmptyStateCard } from '@howaboua/howcode-sdk/common/empty-state-card'
import { MarkdownContent } from '@howaboua/howcode-sdk/markdown/markdown-content'
import { inlineEmptyNoteClass } from '@howaboua/howcode-sdk/ui/classes'
import {
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeControlStrongClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeReadableClass,
  appTypeSectionTitleClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { chatSessionStripClass } from '@howcode/ui/classes'
import type { InboxChat } from '../desktop/types'
import { openExternalQuery } from '../query/desktop-query'
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
            Select a chat on the left to skim Pi’s latest reply and either answer or clear it.
          </div>
        </EmptyStateCard>
      </div>
    </div>
  )
}

export function InboxChatHeader({ chat }: { chat: InboxChat }) {
  const prompt = chat.prompt?.trim() || chat.title
  return (
    <div className="mx-auto w-full max-w-[832px]">
      <div className={`${chatSessionStripClass} gap-2 px-3.5 py-3`}>
        <div
          className={`flex min-w-0 items-center gap-2 ${appTypeMetaClass} ${appToneSubtleClass}`}
        >
          <span className="truncate">{chat.directoryName}</span>
          {chat.branchName ? (
            <>
              <span aria-hidden="true">•</span>
              <span className="truncate">{chat.branchName}</span>
            </>
          ) : null}
          <span aria-hidden="true">•</span>
          <span className="shrink-0 tabular-nums">{chat.age}</span>
          {chat.running ? (
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

export function InboxChatMessage({ chat }: { chat: InboxChat }) {
  const messageMarkdown = chat.content.join('\n\n').trim()
  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="grid h-full w-full content-start justify-items-center pb-5">
        <div className={`min-h-0 w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} text-pretty`}>
          <div className="border-t border-[color:var(--border)]/70 pt-2">
            {messageMarkdown ? (
              <MarkdownContent
                openExternal={openExternalQuery}
                markdown={messageMarkdown}
                className={`gap-3 ${appTypeReadableClass} text-pretty`}
              />
            ) : (
              <div
                className={`grid min-h-28 place-items-center rounded-lg bg-[color:var(--folded-row-bg)] ${inlineEmptyNoteClass}`}
              >
                {chat.running ? 'Still working…' : 'No final assistant message yet.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
