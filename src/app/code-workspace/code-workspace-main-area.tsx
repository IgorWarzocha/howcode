import { DiffPanel } from '@howcode/native-gitops'
import { defaultPiSettings } from '@howcode/shared/default-pi-settings'
import type { AppShellController } from '../app-shell/useAppShellController'
import { mainPanelClass } from '../ui/classes'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../ui/layout'
import { cn } from '../utils/cn'
import type { CodeWorkspaceContentProps } from './code-workspace-contract'
import { FALLBACK_APP_SETTINGS } from './code-workspace-defaults'
import { CodeWorkspaceMainView } from './code-workspace-main-view'
import { useGitOpsFileActions } from './use-gitops-file-actions'

function getMainPanelClass(
  activeView: AppShellController['workspace']['state']['activeView'],
  showDiffInMainView: boolean,
) {
  return activeView === 'thread' ||
    activeView === 'code' ||
    activeView === 'inbox' ||
    showDiffInMainView
    ? 'min-h-0 overflow-hidden'
    : mainPanelClass
}

function CodeWorkspaceDiffMain(props: CodeWorkspaceContentProps) {
  const fileActions = useGitOpsFileActions(props.handleAction)
  return (
    <DiffPanel
      fileActions={fileActions}
      projectId={props.composerProjectId}
      isGitRepo={props.projectGitState?.isGitRepo ?? false}
      baseline={props.diffBaseline}
      selectedFilePath={props.state.selectedDiffFilePath}
      selectedCommentId={props.gitOpsReview.selection.commentId}
      selectedCommentJumpKey={props.gitOpsReview.selection.jumpKey}
      diffRenderMode={props.diffRenderMode}
      layoutMode="main"
      showFileTree={props.gitOpsFileTreeVisible}
      includeUntracked={props.includeUntrackedDiffFiles}
      loading={props.controller.projects.gitLoading && !props.projectGitState}
      onLoadErrorChange={props.setDiffLoadError}
    />
  )
}

function CodeWorkspaceDefaultMain(props: CodeWorkspaceContentProps) {
  const appSettings = props.shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  const selectedProjectId =
    (props.controller.workspace.state.activeView === 'project' ||
      props.controller.workspace.state.activeView === 'sessions' ||
      props.controller.workspace.state.activeView === 'extensions' ||
      props.controller.workspace.state.activeView === 'skills') &&
    props.controller.workspace.state.hasSelectedProject
      ? props.controller.workspace.state.selectedProjectId
      : ''
  return (
    <CodeWorkspaceMainView
      activeView={props.state.activeView}
      appSettings={appSettings}
      piSettings={props.shellState?.piSettings ?? defaultPiSettings}
      piTheme={props.shellState?.piTheme ?? null}
      resolvedPiDirectory={props.shellState?.agentDir ?? null}
      archivedThreads={props.controller.thread.archived}
      availableModels={props.activeComposerState?.availableModels ?? []}
      availableThinkingLevels={props.activeComposerState?.availableThinkingLevels ?? ['off']}
      contextUsage={props.activeComposerState?.contextUsage ?? null}
      currentModel={props.activeComposerState?.currentModel ?? null}
      currentThinkingLevel={props.activeComposerState?.currentThinkingLevel ?? 'off'}
      isCompacting={props.activeComposerState?.isCompacting ?? false}
      currentProjectName={props.currentProjectName}
      selectedInboxThread={props.controller.inbox.selectedThread}
      projects={props.controller.projects.items}
      projectGitState={props.projectGitState}
      settingsOpenTarget={props.controller.settings.openTarget}
      selectedProjectId={selectedProjectId}
      workspaceContentClass={props.workspaceContentClass}
      threadData={props.activeThreadData}
      threadLoading={props.threadTimelineLoading}
      composerLayoutVersion={props.composerLayoutVersion}
      composerOverlayHeight={props.composerOverlayHeight}
      onAction={props.handleAction}
      onDismissInboxThread={props.controller.inbox.dismiss}
      onListAttachmentEntries={props.listComposerAttachmentEntries}
      onOpenThread={props.controller.thread.open}
      onOpenSettingsView={(target) => props.controller.navigation.showView('settings', target)}
      sidebarCollapsed={props.sidebarCollapsed}
      sidebarCompactMode={props.sidebarCompactMode}
      onToggleSidebar={props.onToggleSidebar}
      onCloseUtilityView={props.controller.navigation.closeUtilityView}
      onLoadEarlierMessages={props.handleLoadEarlierMessages}
      onSetExtensionsProjectScopeActive={props.controller.resourceScope.setExtensionsActive}
      onSetSkillsProjectScopeActive={props.controller.resourceScope.setSkillsActive}
      onSelectProject={props.controller.projects.select}
    />
  )
}

export function CodeWorkspaceMainArea(props: CodeWorkspaceContentProps) {
  return (
    <div
      className={cn(
        'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
        WORKSPACE_EDGE_PADDING_CLASS,
      )}
      style={{ ...props.terminalDrawerInsetStyle, bottom: `${props.footerInset}px` }}
    >
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
        <main
          ref={props.mainViewRef}
          className={getMainPanelClass(props.state.activeView, props.showDiffInMainView)}
        >
          {props.showDiffInMainView ? (
            <CodeWorkspaceDiffMain {...props} />
          ) : (
            <CodeWorkspaceDefaultMain {...props} />
          )}
        </main>
      </div>
    </div>
  )
}
