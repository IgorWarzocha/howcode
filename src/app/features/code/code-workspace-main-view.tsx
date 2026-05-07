import { lazy, Suspense } from 'react'
import type {
  AppSettings,
  ArchivedThread,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
  PiSettings,
  PiThemeState,
  ThreadData,
} from '../../desktop/types'
import type { Project, View } from '../../types'
import { ArchivedThreadsView } from '../../views/archived-threads-view'
import { InboxView } from '../../views/inbox-view'
import { LandingView } from '../../views/landing-view'
import { SettingsView } from '../../views/settings-view'
import { ThreadView } from '../../views/thread-view'

const ExtensionsView = lazy(async () => {
  const module = await import('../extensions/extensions-view')
  return { default: module.ExtensionsView }
})

const SkillsView = lazy(async () => {
  const module = await import('../skills/skills-view')
  return { default: module.SkillsView }
})

type CodeWorkspaceMainViewProps = {
  activeView: View
  appSettings: AppSettings
  piSettings: PiSettings
  piTheme: PiThemeState | null
  archivedThreads: ArchivedThread[]
  availableModels: ComposerModel[]
  availableThinkingLevels: ComposerThinkingLevel[]
  contextUsage: ComposerContextUsage | null
  currentModel: ComposerModel | null
  currentThinkingLevel: ComposerThinkingLevel
  isCompacting: boolean
  currentProjectName: string
  selectedInboxThread: InboxThread | null
  projects: Project[]
  selectedProjectId: string
  workspaceContentClass: string
  threadData: ThreadData | null
  threadLoading?: boolean
  composerLayoutVersion: number
  composerOverlayHeight: number
  onAction: DesktopActionInvoker
  onDismissInboxThread: (thread: InboxThread) => void
  onListAttachmentEntries: (request: {
    projectId?: string | null
    path?: string | null
    rootPath?: string | null
  }) => Promise<ComposerFilePickerState | null>
  onCloseUtilityView: () => void
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
  onOpenSettingsView: () => void
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
  onLoadEarlierMessages: () => void
  onSetExtensionsProjectScopeActive: (active: boolean) => void
  onSetSkillsProjectScopeActive: (active: boolean) => void
  onSelectProject: (projectId: string) => void
}

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  piSettings,
  piTheme,
  archivedThreads,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  isCompacting,
  currentProjectName,
  selectedInboxThread,
  projects,
  selectedProjectId,
  workspaceContentClass,
  threadData,
  threadLoading = false,
  composerLayoutVersion,
  composerOverlayHeight,
  onAction,
  onDismissInboxThread,
  onListAttachmentEntries,
  onCloseUtilityView,
  onOpenThread,
  onOpenSettingsView,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
  onLoadEarlierMessages,
  onSetExtensionsProjectScopeActive,
  onSetSkillsProjectScopeActive,
  onSelectProject,
}: CodeWorkspaceMainViewProps) {
  if (activeView === 'thread') {
    return (
      <ThreadView
        key={threadData?.sessionPath ?? 'new-thread'}
        messages={threadData?.messages ?? []}
        previousMessageCount={threadData?.previousMessageCount ?? 0}
        isStreaming={threadData?.isStreaming ?? false}
        isCompacting={threadData?.isCompacting ?? false}
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        loading={threadLoading}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    )
  }

  if (activeView === 'inbox') {
    return (
      <InboxView
        key={selectedInboxThread?.sessionPath ?? 'inbox-empty'}
        appSettings={appSettings}
        availableModels={availableModels}
        availableThinkingLevels={availableThinkingLevels}
        contextUsage={contextUsage}
        currentModel={currentModel}
        currentThinkingLevel={currentThinkingLevel}
        favoriteFolders={appSettings.favoriteFolders}
        isCompacting={isCompacting}
        showDictationButton={appSettings.showDictationButton}
        thread={selectedInboxThread}
        onAction={onAction}
        onDismissThread={onDismissInboxThread}
        onListAttachmentEntries={onListAttachmentEntries}
        onOpenThread={onOpenThread}
        onOpenSettingsView={onOpenSettingsView}
        sidebarCollapsed={sidebarCollapsed}
        sidebarCompactMode={sidebarCompactMode}
        onToggleSidebar={onToggleSidebar}
      />
    )
  }

  if (activeView === 'settings') {
    return (
      <SettingsView
        appSettings={appSettings}
        piSettings={piSettings}
        piTheme={piTheme}
        availableModels={availableModels}
        availableThinkingLevels={availableThinkingLevels}
        currentModel={currentModel}
        projects={projects}
        onAction={onAction}
        onClose={onCloseUtilityView}
      />
    )
  }

  if (activeView === 'archived') {
    return <ArchivedThreadsView threads={archivedThreads} onAction={onAction} />
  }

  if (activeView === 'extensions') {
    return (
      <Suspense
        fallback={
          <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
            <div className="grid gap-1">
              <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Extensions</h1>
              <p className="m-0 text-[13px] text-[color:var(--muted)]">Loading packages…</p>
            </div>
          </div>
        }
      >
        <ExtensionsView
          projectPath={selectedProjectId || null}
          onSetProjectScopeActive={onSetExtensionsProjectScopeActive}
          onClose={onCloseUtilityView}
        />
      </Suspense>
    )
  }

  if (activeView === 'skills') {
    return (
      <Suspense
        fallback={
          <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
            <div className="grid gap-1">
              <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Skills</h1>
              <p className="m-0 text-[13px] text-[color:var(--muted)]">Loading skills…</p>
            </div>
          </div>
        }
      >
        <SkillsView
          appSettings={appSettings}
          projectPath={selectedProjectId || null}
          onSetProjectScopeActive={onSetSkillsProjectScopeActive}
          onAction={onAction}
          onClose={onCloseUtilityView}
        />
      </Suspense>
    )
  }

  return (
    <div className="relative grid h-full min-h-0 w-full justify-items-center overflow-hidden px-4">
      <LandingView
        appSettings={appSettings}
        className={workspaceContentClass}
        projectName={currentProjectName}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onAction={onAction}
        onSelectProject={onSelectProject}
      />
    </div>
  )
}
