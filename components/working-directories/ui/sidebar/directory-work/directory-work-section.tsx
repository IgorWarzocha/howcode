import { FolderCode } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../../../src/app/app-shell/keybinding-events'
import { SidebarDirectoriesSkeleton } from '../../../../../src/app/components/sidebar/sidebar-skeletons'
import type {
  AppSettings,
  DesktopActionInvoker,
  DirectoryGitState,
} from '../../../../../src/app/desktop/types'
import type { SettingsOpenTarget } from '../../../../../src/app/settings/settings/settingsTypes'
import type { View, WorkingDirectory } from '../../../../../src/app/types'
import {
  buildBranchGroups,
  filterBranchGroups,
  UNASSIGNED_BRANCH_GROUP_ID,
} from './branch-group-model'
import { getChatBucketsForDirectoryWork } from './directory-chat-model'
import {
  getCurrentBranchForDirectory,
  getDirectoryGitStateForSidebar,
  getRepositoryBranchesForDirectory,
  getWorktreeBranchesForDirectory,
  hasUncommittedDirectoryChanges,
} from './directory-git-model'
import { DirectoryInstallTargetList } from './directory-install-target-list'
import { DirectoryScopeSelector } from './directory-scope-selector'
import { MultiDirectoryWorkContent, SingleDirectoryWorkContent } from './directory-work-content'
import { useDirectoryChatLoading } from './useDirectoryChatLoading'
import { useDirectoryGitStates } from './useDirectoryGitStates'
import { useDirectoryScopeController } from './useDirectoryScopeController'

type DirectoryWorkSectionProps = {
  activeView: View
  loading: boolean
  directories: WorkingDirectory[]
  directoryGitState: DirectoryGitState | null
  collapsedDirectoryIds: Record<string, boolean>
  initialVisibleDirectoryIds: string[] | null | undefined
  selectedDirectoryId: string
  selectedChatId: string | null
  directoryTargetMode?: boolean | undefined
  embedded?: boolean
  directoryScopeLockActive?: boolean | undefined
  terminalRunningWorkspaceIds: ReadonlySet<string>
  terminalRunningConversationIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onLoadDirectoryChats: (
    directoryId: string,
    options?: { replaceLocalDraftConversationId?: string | null | undefined },
  ) => Promise<unknown>
  appSettings: AppSettings
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onDirectorySelect: (directoryId: string) => void
  onDirectoryPrimeSelection: (directoryId: string) => void
  onDirectoryTargetSelected?: (() => void) | undefined
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
  onShowView: (view: View) => void
  onToggleDirectoryCollapse: (directoryId: string) => void
}

export function DirectoryWorkSection({
  activeView,
  appSettings,
  loading,
  directories,
  directoryGitState,
  collapsedDirectoryIds,
  directoryTargetMode = false,
  embedded = false,
  initialVisibleDirectoryIds,
  selectedDirectoryId,
  selectedChatId,
  terminalRunningWorkspaceIds,
  terminalRunningConversationIds,
  onAction,
  onLoadDirectoryChats,
  onOpenSettingsPanel,
  onDirectorySelect,
  onDirectoryPrimeSelection,
  onDirectoryTargetSelected,
  onChatOpen,
  onShowView,
  onToggleDirectoryCollapse,
}: DirectoryWorkSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const scope = useDirectoryScopeController({
    initialVisibleDirectoryIds,
    directories,
    directoryTargetMode,
    selectedDirectoryId,
    onAction,
    onDirectoryPrimeSelection,
    onDirectorySelect,
    onShowView,
  })
  const {
    displayableDirectories,
    displayableWorkspaces,
    focusDirectory,
    primeDirectory,
    directoryScopeLabel,
    directorySwitcherOpen,
    scopeDirectory,
    scopeSelectorDirectories,
    selectedDirectory,
    setDirectorySwitcherOpen,
    toggleVisibleDirectory,
    visibleDirectories,
  } = scope

  useHowcodeKeybindingCommand('sidebar.find', (event) => {
    if (embedded) return
    event.preventDefault()
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  useLayoutEffect(() => {
    if (!selectedChatId) return
    const selectedRow = document.querySelector(
      '.sidebar-project-work-section .sidebar-thread-row[data-selected="true"]',
    )
    selectedRow?.scrollIntoView({ block: 'nearest' })
  }, [selectedChatId])
  const gitStatesByDirectoryId = useDirectoryGitStates(visibleDirectories, directoryGitState)
  useDirectoryChatLoading({
    allWorkspaces: displayableWorkspaces,
    visibleDirectories: embedded ? [] : visibleDirectories,
    onLoadDirectoryChats,
  })

  if (displayableDirectories.length === 0) {
    if (loading) return <SidebarDirectoriesSkeleton />
    return (
      <section className="sidebar-project-work-section" aria-label="Work">
        <DirectoryScopeSelector
          appSettings={appSettings}
          label="No workspaces yet"
          open={directorySwitcherOpen}
          directories={scopeSelectorDirectories}
          scopeDirectory={null}
          selectedDirectory={null}
          terminalRunningWorkspaceIds={terminalRunningWorkspaceIds}
          visibleDirectories={visibleDirectories}
          onAction={onAction}
          onOpenChange={setDirectorySwitcherOpen}
          onOpenSettingsPanel={onOpenSettingsPanel}
          onToggleVisibleDirectory={toggleVisibleDirectory}
        />
        <div className="sidebar-project-work-empty">
          <FolderCode size={18} />
          <span>Add a workspace to get started</span>
        </div>
      </section>
    )
  }

  if (directoryTargetMode) {
    return (
      <section className="sidebar-project-work-section" aria-label="Workspace install target">
        <DirectoryInstallTargetList
          directories={displayableDirectories}
          selectedDirectoryId={selectedDirectoryId}
          terminalRunningWorkspaceIds={terminalRunningWorkspaceIds}
          onAction={onAction}
          onDirectoryPrimeSelection={onDirectoryPrimeSelection}
          onDirectoryTargetSelected={onDirectoryTargetSelected}
        />
      </section>
    )
  }

  if (!selectedDirectory) return null

  const contentDirectory =
    visibleDirectories.length === 1
      ? (visibleDirectories[0] ?? selectedDirectory)
      : selectedDirectory

  const { activeChats, olderChats } = embedded
    ? { activeChats: [], olderChats: [] }
    : getChatBucketsForDirectoryWork(contentDirectory, displayableWorkspaces, selectedChatId)
  const currentBranch = getCurrentBranchForDirectory(
    contentDirectory,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  const repositoryBranches = getRepositoryBranchesForDirectory(
    contentDirectory,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  const contentDirectoryGitState = getDirectoryGitStateForSidebar(
    contentDirectory.id,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  const currentBranchDirty = hasUncommittedDirectoryChanges(contentDirectoryGitState)
  const worktreeBranches = getWorktreeBranchesForDirectory(
    contentDirectory,
    displayableWorkspaces,
    directoryGitState,
    gitStatesByDirectoryId,
  )
  const branchGroups = buildBranchGroups(
    activeChats,
    currentBranch,
    repositoryBranches,
    worktreeBranches,
  )
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const visibleBranchGroups = filterBranchGroups(branchGroups, searchQuery)
  const selectedChat = contentDirectory.chats.find((chat) => chat.id === selectedChatId)
  const selectedWorkspaceId = selectedChat?.branchName?.trim() || UNASSIGNED_BRANCH_GROUP_ID
  const multiDirectoryMode = visibleDirectories.length > 1
  return (
    <section className="sidebar-project-work-section" aria-label="Workspace work">
      {embedded ? null : (
        <DirectoryScopeSelector
          appSettings={appSettings}
          label={directoryScopeLabel}
          open={directorySwitcherOpen}
          directories={scopeSelectorDirectories}
          scopeDirectory={scopeDirectory}
          selectedDirectory={selectedDirectory}
          terminalRunningWorkspaceIds={terminalRunningWorkspaceIds}
          visibleDirectories={visibleDirectories}
          onAction={onAction}
          onOpenChange={setDirectorySwitcherOpen}
          onOpenSettingsPanel={onOpenSettingsPanel}
          onToggleVisibleDirectory={toggleVisibleDirectory}
        />
      )}

      {visibleDirectories.length === 0 ? (
        <div className="sidebar-project-work-empty sidebar-project-work-scope-empty">
          <FolderCode size={18} />
          <span>No workspaces selected.</span>
          <span>Choose workspaces from the selector above.</span>
        </div>
      ) : multiDirectoryMode ? (
        <MultiDirectoryWorkContent
          activeView={activeView}
          allDirectories={displayableWorkspaces}
          collapsedBranchIds={collapsedBranchIds}
          collapsedDirectoryIds={collapsedDirectoryIds}
          gitStatesByDirectoryId={gitStatesByDirectoryId}
          directoryGitState={directoryGitState}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedDirectoryId={selectedDirectoryId}
          selectedChatId={selectedChatId}
          hideSessionCounts={appSettings.hideSidebarSessionCounts}
          terminalRunningConversationIds={terminalRunningConversationIds}
          visibleDirectories={visibleDirectories}
          onAction={onAction}
          onFocusDirectory={focusDirectory}
          onPrimeDirectory={primeDirectory}
          onSearchQueryChange={setSearchQuery}
          onSetCollapsedBranchIds={setCollapsedBranchIds}
          onToggleDirectoryCollapse={onToggleDirectoryCollapse}
          onShowView={onShowView}
          onChatOpen={onChatOpen}
        />
      ) : (
        <SingleDirectoryWorkContent
          controlsOnly={embedded}
          activeView={activeView}
          branchGroups={visibleBranchGroups}
          collapsedBranchIds={collapsedBranchIds}
          currentBranch={currentBranch}
          currentBranchDirty={currentBranchDirty}
          hideSessionCounts={embedded || appSettings.hideSidebarSessionCounts}
          isGitRepo={Boolean(contentDirectoryGitState?.isGitRepo)}
          normalizedSearchQuery={normalizedSearchQuery}
          olderChatCount={olderChats.length}
          directory={contentDirectory}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedChatId={selectedChatId}
          terminalRunningConversationIds={terminalRunningConversationIds}
          onAction={onAction}
          onFocusDirectory={focusDirectory}
          onSearchQueryChange={setSearchQuery}
          onSetCollapsedBranchIds={setCollapsedBranchIds}
          onShowView={onShowView}
          onChatOpen={onChatOpen}
        />
      )}
    </section>
  )
}
