import type {
  AppSettings,
  DesktopActionInvoker,
  ProjectGitState,
  ThreadData,
} from '../../../../src/app/desktop/types'
import { SessionsView } from '../../../../src/app/sessions/index'
import { ThreadView } from '../../../../src/app/thread/index'
import type { Project, View } from '../../../../src/app/types'
import { LandingView, ProjectOverviewView } from '../projects/index'

type CodeWorkspaceMainViewProps = {
  activeView: View
  appSettings: AppSettings
  currentProjectName: string
  projects: Project[]
  projectGitState: ProjectGitState | null
  selectedProjectId: string
  workspaceContentClass: string
  threadData: ThreadData | null
  threadLoading?: boolean
  composerLayoutVersion: number
  composerOverlayHeight: number
  onAction: DesktopActionInvoker
  onCloseUtilityView: () => void
  onOpenThread: (projectId: string, threadId: string, conversationId: string) => void
  onLoadEarlierMessages: () => void
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
      key={threadData?.conversationId ?? 'new-thread'}
      messages={threadData?.messages ?? []}
      previousMessageCount={threadData?.previousMessageCount ?? 0}
      isStreaming={threadData?.isStreaming ?? false}
      isCompacting={threadData?.isCompacting ?? false}
      composerLayoutVersion={composerLayoutVersion}
      composerOverlayHeight={composerOverlayHeight}
      conversationId={threadData?.conversationId ?? null}
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
  currentProjectName,
  projects,
  projectGitState,
  selectedProjectId,
  workspaceContentClass,
  threadData,
  threadLoading = false,
  composerLayoutVersion,
  composerOverlayHeight,
  onAction,
  onCloseUtilityView,
  onOpenThread,
  onLoadEarlierMessages,
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
