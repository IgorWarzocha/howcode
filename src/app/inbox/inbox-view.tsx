import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { getInboxThreadComposerMode, getInboxThreadOpenView } from '../common/inbox-thread-scope'
import type {
  AppSettings,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
} from '../desktop/types'
import { WorkspaceComposerDock } from '../workspace-shell/workspace-composer-dock'
import { InboxComposer } from './components/inbox-composer'
import { InboxEmptyState, InboxThreadHeader, InboxThreadMessage } from './inbox-thread-content'
import { useInboxReplyController } from './useInboxReplyController'

type InboxViewProps = {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  isCompacting: boolean
  thread: InboxThread | null
  onAction: DesktopActionInvoker
  onDismissThread: (thread: InboxThread) => void
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onOpenThread: (
    projectId: string,
    threadId: string,
    sessionPath: string,
    view?: 'chat' | 'thread' | undefined,
    branchName?: string | null | undefined,
  ) => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

type InboxThreadViewProps = Omit<InboxViewProps, 'thread'> & { thread: InboxThread }

function InboxSidebarToggle({
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}) {
  if (sidebarCompactMode && !sidebarCollapsed) return null
  const showSidebar = sidebarCollapsed || sidebarCompactMode
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={showSidebar ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip={showSidebar ? 'Show sidebar' : 'Hide sidebar'}
      data-tooltip-placement="right"
    >
      {showSidebar ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

function InboxThreadView({
  appSettings,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  isCompacting,
  thread,
  onAction,
  onDismissThread,
  onListAttachmentEntries,
  onOpenThread,
  onOpenSettingsView,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: InboxThreadViewProps) {
  const reply = useInboxReplyController({
    isCompacting,
    onAction,
    onDismissThread,
    streamingBehavior: appSettings.composerStreamingBehavior,
    thread,
  })

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] pt-6 pb-4">
      <InboxThreadHeader thread={thread} />
      <InboxThreadMessage thread={thread} />

      <div>
        <WorkspaceComposerDock
          compactControls={sidebarCompactMode || sidebarCollapsed}
          left={
            <InboxSidebarToggle
              sidebarCollapsed={sidebarCollapsed}
              sidebarCompactMode={sidebarCompactMode}
              onToggleSidebar={onToggleSidebar}
            />
          }
          center={
            <InboxComposer
              appSettings={appSettings}
              isCompacting={isCompacting}
              modelState={{
                availableModels,
                availableThinkingLevels,
                contextUsage,
                currentModel,
                currentThinkingLevel,
              }}
              reply={reply}
              thread={thread}
              onAction={onAction}
              onDismiss={() => onDismissThread(thread)}
              onListAttachmentEntries={onListAttachmentEntries}
              onOpenThread={() =>
                onOpenThread(
                  thread.projectId,
                  thread.threadId,
                  thread.sessionPath,
                  getInboxThreadOpenView(thread),
                  thread.branchName,
                )
              }
              onOpenSettingsView={onOpenSettingsView}
              onStartNewSession={() =>
                void onAction('thread.new', {
                  projectId: thread.projectId,
                  composerMode: getInboxThreadComposerMode(thread),
                  branchName: thread.branchName,
                })
              }
            />
          }
        />
      </div>
    </div>
  )
}

export function InboxView(props: InboxViewProps) {
  if (!props.thread) return <InboxEmptyState />
  return <InboxThreadView {...props} thread={props.thread} />
}
