import { ArchivedThreadsView } from '@howcode/archive'
import { InboxView } from '@howcode/inbox'
import { LandingView, ProjectOverviewView } from '@howcode/projects'
import { SessionsView } from '@howcode/sessions'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { ThreadView } from '@howcode/thread'
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
  ProjectGitState,
  ThreadData,
} from '../desktop/types'
import { SettingsView } from '../settings/settings-view'
import type { Project, View } from '../types'
import { viewSubtitleClass, viewTitleClass } from '../ui/classes'

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
  resolvedPiDirectory?: string | null | undefined
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
  projectGitState: ProjectGitState | null
  settingsOpenTarget?: SettingsOpenTarget | null | undefined
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
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
  onLoadEarlierMessages: () => void
  onSetExtensionsProjectScopeActive: (active: boolean) => void
  onSetSkillsProjectScopeActive: (active: boolean) => void
  onSelectProject: (projectId: string) => void
}

function CodeThreadMainView({
  composerLayoutVersion,
  composerOverlayHeight,
  onLoadEarlierMessages,
  threadData,
  threadLoading,
}: Pick<
  CodeWorkspaceMainViewProps,
  | 'composerLayoutVersion'
  | 'composerOverlayHeight'
  | 'onLoadEarlierMessages'
  | 'threadData'
  | 'threadLoading'
>) {
  return (
    <ThreadView
      key={threadData?.sessionPath ?? 'new-thread'}
      messages={threadData?.messages ?? []}
      previousMessageCount={threadData?.previousMessageCount ?? 0}
      isStreaming={threadData?.isStreaming ?? false}
      isCompacting={threadData?.isCompacting ?? false}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      sessionPath={threadData?.sessionPath ?? null}
      loading={threadLoading ?? false}
      onLoadEarlierMessages={onLoadEarlierMessages}
      onLoadAroundMessage={onLoadEarlierMessages}
    />
  )
}

function CodeWorkspaceProjectOrEmptyView({
  appSettings,
  composerOverlayHeight,
  currentProjectName,
  onAction,
  onOpenThread,
  onSelectProject,
  projects,
  selectedProjectId,
  workspaceContentClass,
}: Pick<
  CodeWorkspaceMainViewProps,
  | 'appSettings'
  | 'composerOverlayHeight'
  | 'currentProjectName'
  | 'onAction'
  | 'onOpenThread'
  | 'onSelectProject'
  | 'projects'
  | 'selectedProjectId'
  | 'workspaceContentClass'
>) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const showProjectDashboard = Boolean(selectedProject && appSettings.projectDashboardEnabled)
  const showLandingPage = !selectedProject

  return (
    <div
      className={`relative grid h-full min-h-0 w-full justify-items-center overflow-hidden ${selectedProjectId ? 'px-0' : 'px-4'}`}
    >
      {showLandingPage ? (
        <LandingView
          appSettings={appSettings}
          className={workspaceContentClass}
          projectName={currentProjectName}
          projects={projects}
          selectedProjectId=""
          composerOverlayHeight={composerOverlayHeight}
          onAction={onAction}
          onOpenThread={onOpenThread}
          onSelectProject={onSelectProject}
        />
      ) : showProjectDashboard && selectedProject ? (
        <ProjectOverviewView
          composerOverlayHeight={composerOverlayHeight}
          project={selectedProject}
          onOpenThread={onOpenThread}
          onAction={onAction}
        />
      ) : null}
    </div>
  )
}

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  piSettings,
  piTheme,
  resolvedPiDirectory,
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
  projectGitState,
  settingsOpenTarget,
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
      <CodeThreadMainView
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        threadData={threadData}
        threadLoading={threadLoading}
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
        isCompacting={isCompacting}
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
        resolvedPiDirectory={resolvedPiDirectory}
        availableModels={availableModels}
        availableThinkingLevels={availableThinkingLevels}
        currentModel={currentModel}
        projects={projects}
        openTarget={settingsOpenTarget}
        onAction={onAction}
        onClose={onCloseUtilityView}
      />
    )
  }

  if (activeView === 'archived') {
    return <ArchivedThreadsView threads={archivedThreads} onAction={onAction} />
  }

  if (activeView === 'sessions') {
    const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
    const currentBranch =
      projectGitState?.projectId === selectedProjectId && projectGitState.isGitRepo
        ? projectGitState.branch
        : null
    return (
      <SessionsView
        currentBranch={currentBranch}
        project={selectedProject}
        projects={projects}
        onAction={onAction}
        onClose={onCloseUtilityView}
        onOpenThread={onOpenThread}
      />
    )
  }

  if (activeView === 'extensions') {
    return (
      <Suspense
        fallback={
          <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
            <div className="grid gap-1">
              <h1 className={viewTitleClass}>Extensions</h1>
              <p className={viewSubtitleClass}>Loading packages…</p>
            </div>
          </div>
        }
      >
        <ExtensionsView
          projectPath={selectedProjectId || null}
          onSetProjectScopeActive={onSetExtensionsProjectScopeActive}
          onProjectTargetSelected={() => onSetExtensionsProjectScopeActive(true)}
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
              <h1 className={viewTitleClass}>Skills</h1>
              <p className={viewSubtitleClass}>Loading skills…</p>
            </div>
          </div>
        }
      >
        <SkillsView
          appSettings={appSettings}
          projectPath={selectedProjectId || null}
          onSetProjectScopeActive={onSetSkillsProjectScopeActive}
          onProjectTargetSelected={() => onSetSkillsProjectScopeActive(true)}
          onAction={onAction}
          onClose={onCloseUtilityView}
        />
      </Suspense>
    )
  }

  return (
    <CodeWorkspaceProjectOrEmptyView
      appSettings={appSettings}
      composerOverlayHeight={composerOverlayHeight}
      currentProjectName={currentProjectName}
      onAction={onAction}
      onOpenThread={onOpenThread}
      onSelectProject={onSelectProject}
      projects={projects}
      selectedProjectId={selectedProjectId}
      workspaceContentClass={workspaceContentClass}
    />
  )
}
