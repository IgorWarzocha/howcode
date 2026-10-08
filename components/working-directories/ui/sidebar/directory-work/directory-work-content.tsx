import { Archive, ChevronRight, Home } from 'lucide-react'
import type { RefObject } from 'react'
import { IconButton } from '../../../../../src/app/common/icon-button'
import type { DesktopActionInvoker, DirectoryGitState } from '../../../../../src/app/desktop/types'
import type { View, WorkingDirectory } from '../../../../../src/app/types'
import { appToneSubtleClass } from '../../../../../src/app/ui/classes'
import { cn } from '../../../../../src/app/utils/cn'
import { BranchWorkspaceSection } from './branch-chat-group-section'
import { shouldSeparateBranchGroups } from './branch-group-layout'
import {
  type BranchWorkspace,
  buildBranchGroups,
  UNASSIGNED_BRANCH_GROUP_ID,
} from './branch-group-model'
import { getChatBucketsForDirectoryWork } from './directory-chat-model'
import {
  getCurrentBranchForDirectory,
  getRepositoryBranchesForDirectory,
  getWorktreeBranchesForDirectory,
  hasUncommittedDirectoryChanges,
} from './directory-git-model'
import { DirectoryWorkActionsMenuButton } from './directory-work-actions-menu'
import { DirectoryWorkSummaryBlock } from './directory-work-block'
import { DirectoryWorkChatRow } from './directory-work-chat-row'
import { SearchHistoryField } from './directory-work-fields'
import { NewChatMenu } from './new-chat-menu'

function DirectoryDashboardButton({
  active,
  directory,
  onOpenDashboard,
}: {
  active: boolean
  directory: WorkingDirectory
  onOpenDashboard: () => void
}) {
  return (
    <IconButton
      label={`Open ${directory.name} dashboard`}
      icon={<Home size={13} />}
      active={active}
      tooltip="Workspace dashboard"
      tooltipPlacement="right"
      className="sidebar-project-work-project-menu-button h-7 w-7 rounded-md"
      onClick={onOpenDashboard}
    />
  )
}

function NonGitDirectoryChats({
  activeView,
  branchGroups,
  directory,
  selectedChatId,
  terminalRunningConversationIds,
  onAction,
  onChatOpen,
}: {
  activeView: View
  branchGroups: BranchWorkspace[]
  directory: WorkingDirectory
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  const chats = branchGroups.flatMap((group) => group.chats)
  return (
    <div className="sidebar-project-work-thread-list">
      {chats.map((chat) => (
        <DirectoryWorkChatRow
          key={chat.id}
          activeView={activeView}
          currentBranch={null}
          directory={directory}
          selectedChatId={selectedChatId}
          terminalRunningConversationIds={terminalRunningConversationIds}
          chat={chat}
          onAction={onAction}
          onChatOpen={onChatOpen}
        />
      ))}
    </div>
  )
}

export function MultiDirectoryWorkContent({
  activeView,
  allDirectories,
  collapsedBranchIds,
  collapsedDirectoryIds,
  gitStatesByDirectoryId,
  directoryGitState,
  searchInputRef,
  searchQuery,
  selectedDirectoryId,
  selectedChatId,
  hideSessionCounts,
  terminalRunningConversationIds,
  visibleDirectories,
  onAction,
  onFocusDirectory,
  onPrimeDirectory,
  onSearchQueryChange,
  onSetCollapsedBranchIds,
  onToggleDirectoryCollapse,
  onShowView,
  onChatOpen,
}: {
  activeView: View
  allDirectories: WorkingDirectory[]
  collapsedBranchIds: Record<string, boolean>
  collapsedDirectoryIds: Record<string, boolean>
  gitStatesByDirectoryId: ReadonlyMap<string, DirectoryGitState | null>
  directoryGitState: DirectoryGitState | null
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  selectedDirectoryId: string
  selectedChatId: string | null
  hideSessionCounts: boolean
  terminalRunningConversationIds: ReadonlySet<string>
  visibleDirectories: WorkingDirectory[]
  onAction: DesktopActionInvoker
  onFocusDirectory: (directoryId: string) => void
  onPrimeDirectory: (directoryId: string) => void
  onSearchQueryChange: (query: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onToggleDirectoryCollapse: (directoryId: string) => void
  onShowView: (view: View) => void
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  return (
    <div className="sidebar-project-work-lane">
      <div className="sidebar-project-work-section-heading sidebar-project-work-section-heading--search-only">
        <SearchHistoryField
          inputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
        />
      </div>
      <div className="sidebar-project-work-scroll-shell">
        <div className="sidebar-project-work-thread-list sidebar-project-work-project-block-list">
          {visibleDirectories.map((directory) => {
            const buckets = getChatBucketsForDirectoryWork(
              directory,
              allDirectories,
              selectedChatId,
            )
            const blockCurrentBranch = getCurrentBranchForDirectory(
              directory,
              directoryGitState,
              gitStatesByDirectoryId,
            )
            const repositoryBranches = getRepositoryBranchesForDirectory(
              directory,
              directoryGitState,
              gitStatesByDirectoryId,
            )
            const worktreeBranches = getWorktreeBranchesForDirectory(
              directory,
              allDirectories,
              directoryGitState,
              gitStatesByDirectoryId,
            )
            const branchGroups = buildBranchGroups(
              buckets.activeChats,
              blockCurrentBranch,
              repositoryBranches,
              worktreeBranches,
            )
            const blockGitState = gitStatesByDirectoryId.get(directory.id) ?? null
            const blockIsGitRepo = Boolean(blockGitState?.isGitRepo)
            const blockCurrentBranchDirty = hasUncommittedDirectoryChanges(blockGitState)
            const unassignedWorkspaceId = `${directory.id}:${UNASSIGNED_BRANCH_GROUP_ID}`
            const expanded = !(collapsedDirectoryIds[directory.id] ?? directory.collapsed ?? true)
            return (
              <DirectoryWorkSummaryBlock
                key={directory.id}
                activeView={activeView}
                branchGroups={branchGroups}
                collapsedBranchIds={collapsedBranchIds}
                currentBranch={blockCurrentBranch}
                currentBranchDirty={blockCurrentBranchDirty}
                expanded={expanded}
                hideSessionCounts={hideSessionCounts}
                isGitRepo={blockIsGitRepo}
                olderChatCount={buckets.olderChats.length}
                directory={directory}
                searchQuery={searchQuery}
                selectedDirectoryId={selectedDirectoryId}
                selectedChatId={selectedChatId}
                terminalRunningConversationIds={terminalRunningConversationIds}
                chats={buckets.activeChats}
                unassignedCollapsed={collapsedBranchIds[unassignedWorkspaceId] ?? true}
                onAction={onAction}
                onFocusDirectory={onFocusDirectory}
                onPrimeDirectory={onPrimeDirectory}
                onSetCollapsedBranchIds={onSetCollapsedBranchIds}
                onShowView={onShowView}
                onChatOpen={onChatOpen}
                onToggleExpanded={() => onToggleDirectoryCollapse(directory.id)}
                onToggleUnassigned={() =>
                  onSetCollapsedBranchIds((current) => ({
                    ...current,
                    [unassignedWorkspaceId]: !(current[unassignedWorkspaceId] ?? true),
                  }))
                }
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function SingleDirectoryWorkContent({
  controlsOnly = false,
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty,
  hideSessionCounts,
  isGitRepo,
  olderChatCount,
  normalizedSearchQuery,
  directory,
  searchInputRef,
  searchQuery,
  selectedWorkspaceId,
  selectedChatId,
  terminalRunningConversationIds,
  onAction,
  onFocusDirectory,
  onSearchQueryChange,
  onSetCollapsedBranchIds,
  onShowView,
  onChatOpen,
}: {
  controlsOnly?: boolean
  activeView: View
  branchGroups: BranchWorkspace[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty: boolean
  hideSessionCounts: boolean
  isGitRepo: boolean
  olderChatCount: number
  normalizedSearchQuery: string
  directory: WorkingDirectory
  searchInputRef: RefObject<HTMLInputElement | null>
  searchQuery: string
  selectedWorkspaceId: string
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onFocusDirectory: (directoryId: string) => void
  onSearchQueryChange: (query: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onShowView: (view: View) => void
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  const openDirectoryView = (view: View) => {
    onFocusDirectory(directory.id)
    onShowView(view)
  }
  const openDirectoryDashboard = () => openDirectoryView('directory')

  return (
    <>
      <div className="sidebar-project-work-toolbar">
        <DirectoryDashboardButton
          active={activeView === 'directory'}
          directory={directory}
          onOpenDashboard={openDirectoryDashboard}
        />
        <div className="sidebar-project-work-toolbar-actions">
          <DirectoryWorkActionsMenuButton directory={directory} onAction={onAction} />
          <NewChatMenu
            currentBranch={currentBranch}
            isGitRepo={isGitRepo}
            onAction={onAction}
            directoryId={directory.id}
          />
        </div>
      </div>

      <div className="sidebar-project-work-actions">
        {controlsOnly ? null : (
          <button
            type="button"
            className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-action-row"
            data-active={activeView === 'automations' ? 'true' : 'false'}
            onClick={() => openDirectoryView('automations')}
          >
            <ChevronRight size={13} aria-hidden="true" />
            <span>Automations</span>
            <span className="sidebar-project-work-pill">Soon</span>
          </button>
        )}
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-history-row"
          data-active={activeView === 'history' && selectedChatId === null ? 'true' : 'false'}
          onClick={() => openDirectoryView('history')}
        >
          <Archive size={14} />
          <span>Past chats</span>
          {hideSessionCounts ? null : (
            <span className={cn('sidebar-project-work-history-count', appToneSubtleClass)}>
              {olderChatCount}
            </span>
          )}
        </button>
      </div>

      <div className="sidebar-project-work-lane">
        {controlsOnly ? null : (
          <div className="sidebar-project-work-section-heading sidebar-project-work-section-heading--search-only">
            <SearchHistoryField
              inputRef={searchInputRef}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
            />
          </div>
        )}

        <div className="sidebar-project-work-scroll-shell">
          {isGitRepo ? (
            <div className="sidebar-project-work-thread-list">
              {branchGroups.map((group, index) => {
                const groupKey = `${directory.id}:${group.id}`
                const defaultCollapsed = !(
                  (group.kind === 'branch' && group.current) ||
                  group.id === selectedWorkspaceId ||
                  group.worktrees.length > 0
                )
                const collapsed = normalizedSearchQuery
                  ? false
                  : (collapsedBranchIds[groupKey] ?? defaultCollapsed)
                const showBottomDivider =
                  !collapsed && shouldSeparateBranchGroups(group, branchGroups[index + 1])
                return (
                  <BranchWorkspaceSection
                    key={group.id}
                    activeView={activeView}
                    collapsed={collapsed}
                    currentBranch={currentBranch}
                    currentBranchDirty={currentBranchDirty}
                    group={group}
                    hideSessionCounts={hideSessionCounts}
                    directory={directory}
                    selectedChatId={selectedChatId}
                    terminalRunningConversationIds={terminalRunningConversationIds}
                    onAction={onAction}
                    showBottomDivider={showBottomDivider}
                    onChatOpen={onChatOpen}
                    onToggle={() =>
                      onSetCollapsedBranchIds((current) => ({
                        ...current,
                        [groupKey]: !collapsed,
                      }))
                    }
                  />
                )
              })}
            </div>
          ) : (
            <NonGitDirectoryChats
              activeView={activeView}
              branchGroups={branchGroups}
              directory={directory}
              selectedChatId={selectedChatId}
              terminalRunningConversationIds={terminalRunningConversationIds}
              onAction={onAction}
              onChatOpen={onChatOpen}
            />
          )}
        </div>
      </div>
    </>
  )
}
