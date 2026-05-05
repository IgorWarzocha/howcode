import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState } from 'react'
import { isCompactSlashCommand } from '../../../shared/composer-slash-commands'
import { EmptyStateCard } from '../components/common/empty-state-card'
import { MarkdownContent } from '../components/common/markdown-content'
import { InboxComposer } from '../components/workspace/inbox/inbox-composer'
import { WorkspaceComposerDock } from '../components/workspace/workspace-composer-dock'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import { getErrorMessage } from '../desktop/error-messages'
import type {
  AppSettings,
  ComposerAttachment,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
} from '../desktop/types'
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from '../ui/layout'

type InboxViewProps = {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  favoriteFolders: string[]
  isCompacting: boolean
  showDictationButton: boolean
  thread: InboxThread | null
  onAction: DesktopActionInvoker
  onDismissThread: (thread: InboxThread) => void
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
  onOpenSettingsView: () => void
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

function getInboxSendPayload(input: {
  appSettings: AppSettings
  attachments: ComposerAttachment[]
  draft: string
  thread: InboxThread
}) {
  const nextDraft = input.draft.trim()
  const isCompactCommand = isCompactSlashCommand(nextDraft)
  return {
    isCompactCommand,
    payload: {
      projectId: input.thread.projectId,
      sessionPath: input.thread.sessionPath,
      text: nextDraft,
      attachments: isCompactCommand ? [] : input.attachments,
      streamingBehavior: input.appSettings.composerStreamingBehavior,
      composerMode: input.thread.isChat ? 'chat' : 'code',
    } as const,
  }
}

function canSendInboxDraft(input: {
  attachments: ComposerAttachment[]
  draft: string
  isCompacting: boolean
  isSending: boolean
  thread: InboxThread | null
}): input is {
  attachments: ComposerAttachment[]
  draft: string
  isCompacting: boolean
  isSending: boolean
  thread: InboxThread
} {
  return Boolean(
    input.thread &&
      !input.isSending &&
      !input.isCompacting &&
      (input.draft.trim().length > 0 || input.attachments.length > 0),
  )
}

async function sendInboxDraft(input: {
  appSettings: AppSettings
  attachments: ComposerAttachment[]
  draft: string
  onAction: DesktopActionInvoker
  thread: InboxThread
}) {
  const sendPayload = getInboxSendPayload(input)
  const result = await input.onAction('composer.send', sendPayload.payload)
  return { isCompactCommand: sendPayload.isCompactCommand, result }
}

function applyInboxSendResult(input: {
  isCompactCommand: boolean
  result: Awaited<ReturnType<DesktopActionInvoker>> | null
  thread: InboxThread
  onDismissThread: (thread: InboxThread) => void
  setAttachments: (attachments: ComposerAttachment[]) => void
  setDraft: (draft: string) => void
  setErrorMessage: (message: string | null) => void
}) {
  const actionErrorMessage = getDesktopActionErrorMessage(input.result, 'Could not send follow-up.')
  if (actionErrorMessage) {
    input.setErrorMessage(actionErrorMessage)
    return
  }

  if (input.result?.result?.composerSendOutcome === 'stopped') return
  input.setDraft('')
  if (!input.isCompactCommand) {
    input.setAttachments([])
    input.onDismissThread(input.thread)
  }
}

export function InboxView({
  appSettings,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  favoriteFolders,
  isCompacting,
  showDictationButton,
  thread,
  onAction,
  onDismissThread,
  onListAttachmentEntries,
  onOpenThread,
  onOpenSettingsView,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: InboxViewProps) {
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSend = async (input?: {
    draft: string | undefined
    attachments: ComposerAttachment[]
  }) => {
    const draftToSend = input?.draft ?? draft
    const attachmentsToSend = input?.attachments ?? attachments
    const nextDraft = draftToSend.trim()
    const activeThread = thread
    if (!activeThread) return
    if (
      !canSendInboxDraft({
        attachments: attachmentsToSend,
        draft: nextDraft,
        isCompacting,
        isSending,
        thread: activeThread,
      })
    )
      return

    setIsSending(true)
    setErrorMessage(null)

    let sendResult: Awaited<ReturnType<typeof sendInboxDraft>> | null = null
    let isCompactCommand = false

    try {
      sendResult = await sendInboxDraft({
        appSettings,
        attachments: attachmentsToSend,
        draft: nextDraft,
        onAction,
        thread: activeThread,
      })
      isCompactCommand = sendResult.isCompactCommand
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not send follow-up.'))
      return
    } finally {
      setIsSending(false)
    }

    applyInboxSendResult({
      isCompactCommand,
      onDismissThread,
      result: sendResult?.result ?? null,
      setAttachments,
      setDraft,
      setErrorMessage,
      thread: activeThread,
    })
  }

  const handleStop = async () => {
    if (!thread?.running || isSending) {
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      const result = await onAction('composer.stop', {
        projectId: thread.projectId,
        sessionPath: thread.sessionPath,
      })

      const actionErrorMessage = getDesktopActionErrorMessage(result, 'Could not stop Pi.')
      if (actionErrorMessage) {
        setErrorMessage(actionErrorMessage)
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not stop Pi.'))
    } finally {
      setIsSending(false)
    }
  }

  if (!thread) {
    return (
      <div className="grid h-full min-h-0 place-items-center px-6 py-6">
        <div className="w-full max-w-[520px]">
          <EmptyStateCard className="grid gap-2 rounded-[18px] px-5 py-5 text-center text-[13px] text-[color:var(--muted)]">
            <div className="text-[15px] font-medium text-[color:var(--text)]">Inbox is waiting</div>
            <div>
              Select a thread on the left to skim Pi’s latest reply and either answer or clear it.
            </div>
          </EmptyStateCard>
        </div>
      </div>
    )
  }

  const prompt = thread.prompt?.trim() || thread.title
  const messageMarkdown = thread.content.join('\n\n').trim()

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] pt-6 pb-4">
      <div className={`mx-auto w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} pb-5`}>
        <div className="grid w-full gap-2 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3 shadow-[var(--shadow)]">
          <div className="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-[color:var(--muted-2)]">
            <span className="truncate">{thread.projectName}</span>
            <span aria-hidden="true">•</span>
            <span className="shrink-0 tabular-nums">{thread.age}</span>
            {thread.running ? (
              <>
                <span aria-hidden="true">•</span>
                <span className="shrink-0 text-[color:var(--accent)]">working</span>
              </>
            ) : null}
          </div>
          <p className="m-0 max-h-[calc(1.55em*4)] overflow-y-auto whitespace-pre-wrap break-words text-[15px] leading-[1.55] text-[color:var(--text)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {prompt}
          </p>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        <div className="grid h-full w-full content-start justify-items-center pb-5">
          <div className={`min-h-0 w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} text-pretty`}>
            {messageMarkdown ? (
              <MarkdownContent
                markdown={messageMarkdown}
                className="gap-3 text-[15px] text-pretty"
              />
            ) : (
              <div className="grid min-h-28 place-items-center rounded-[18px] border border-dashed border-[color:var(--border)] text-[14px] text-[color:var(--muted)]">
                {thread.running ? 'Still working…' : 'No final assistant message yet.'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-1">
        <WorkspaceComposerDock
          compactControls={sidebarCompactMode}
          left={
            sidebarCompactMode ? null : (
              <button
                type="button"
                className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
                onClick={onToggleSidebar}
                aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                data-tooltip={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                data-tooltip-placement="right"
              >
                {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </button>
            )
          }
          center={
            <InboxComposer
              appSettings={appSettings}
              attachments={attachments}
              availableModels={availableModels}
              availableThinkingLevels={availableThinkingLevels}
              contextUsage={contextUsage}
              currentModel={currentModel}
              currentThinkingLevel={currentThinkingLevel}
              draft={draft}
              errorMessage={errorMessage}
              favoriteFolders={favoriteFolders}
              isCompacting={isCompacting}
              isStreaming={thread.running}
              isSending={isSending}
              showDictationButton={showDictationButton}
              thread={thread}
              onChangeDraft={setDraft}
              onChangeAttachments={setAttachments}
              onChangeErrorMessage={setErrorMessage}
              onAction={onAction}
              onDismiss={() => onDismissThread(thread)}
              onListAttachmentEntries={onListAttachmentEntries}
              onOpenThread={() =>
                onOpenThread(thread.projectId, thread.threadId, thread.sessionPath)
              }
              onOpenSettingsView={onOpenSettingsView}
              onSend={(sendInput) => handleSend(sendInput)}
              onStop={handleStop}
            />
          }
        />
      </div>
    </div>
  )
}
