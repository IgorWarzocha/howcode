import { defaultPiSettings } from '../../../../shared/default-pi-settings'
import type { AppShellController } from '../../app-shell/useAppShellController'
import { DiffPanel } from '../../components/workspace/diff-panel'
import { mainPanelClass } from '../../ui/classes'
import { CodeWorkspaceMainView } from './code-workspace-main-view'
import type { CodeWorkspaceContentProps } from './code-workspace-view'
import { FALLBACK_APP_SETTINGS } from './code-workspace-view'

function getMainPanelClass(
  activeView: AppShellController['state']['activeView'],
  showDiffInMainView: boolean,
) {
  return activeView === 'thread' ||
    activeView === 'code' ||
    activeView === 'inbox' ||
    showDiffInMainView
    ? 'min-h-0 overflow-hidden pt-1.5'
    : mainPanelClass
}

function CodeWorkspaceDiffMain(props: CodeWorkspaceContentProps) {
  return (
    <DiffPanel
      projectId={props.composerProjectId}
      isGitRepo={props.projectGitState?.isGitRepo ?? false}
      baseline={props.diffBaseline}
      selectedFilePath={props.state.selectedDiffFilePath}
      selectedCommentId={props.selectedDiffCommentId}
      selectedCommentJumpKey={props.selectedDiffCommentJumpKey}
      diffRenderMode={props.diffRenderMode}
      layoutMode="main"
      showFileTree={props.gitOpsFileTreeVisible}
      loading={props.controller.projectGitLoading}
    />
  )
}

function CodeWorkspaceDefaultMain(props: CodeWorkspaceContentProps) {
  const appSettings = props.shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  return (
    <CodeWorkspaceMainView
      activeView={props.state.activeView}
      appSettings={appSettings}
      piSettings={props.shellState?.piSettings ?? defaultPiSettings}
      piTheme={props.shellState?.piTheme ?? null}
      archivedThreads={props.controller.archivedThreads}
      availableModels={props.activeComposerState?.availableModels ?? []}
      availableThinkingLevels={props.activeComposerState?.availableThinkingLevels ?? ['off']}
      contextUsage={props.activeComposerState?.contextUsage ?? null}
      currentModel={props.activeComposerState?.currentModel ?? null}
      currentThinkingLevel={props.activeComposerState?.currentThinkingLevel ?? 'off'}
      isCompacting={props.activeComposerState?.isCompacting ?? false}
      currentProjectName={props.currentProjectName}
      selectedInboxThread={props.controller.selectedInboxThread}
      projects={props.controller.projects}
      settingsOpenTarget={props.controller.settingsOpenTarget}
      selectedProjectId={props.controller.state.selectedProjectId}
      workspaceContentClass={props.workspaceContentClass}
      threadData={props.activeThreadData}
      threadLoading={props.threadTimelineLoading}
      composerLayoutVersion={props.composerLayoutVersion}
      composerOverlayHeight={props.composerOverlayHeight}
      onAction={props.handleAction}
      onDismissInboxThread={props.controller.handleDismissInboxThread}
      onListAttachmentEntries={props.listComposerAttachmentEntries}
      onOpenThread={props.controller.handleThreadOpen}
      onOpenSettingsView={(target) => props.controller.handleShowView('settings', target)}
      sidebarCollapsed={props.sidebarCollapsed}
      sidebarCompactMode={props.sidebarCompactMode}
      onToggleSidebar={props.onToggleSidebar}
      onCloseUtilityView={props.controller.handleCloseUtilityView}
      onLoadEarlierMessages={props.handleLoadEarlierMessages}
      onSetExtensionsProjectScopeActive={props.controller.handleSetExtensionsProjectScopeActive}
      onSetSkillsProjectScopeActive={props.controller.handleSetSkillsProjectScopeActive}
      onSelectProject={props.controller.handleProjectSelect}
    />
  )
}

export function CodeWorkspaceMainArea(props: CodeWorkspaceContentProps) {
  return (
    <div
      className="motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden px-5"
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
