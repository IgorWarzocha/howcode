import { appToneSubtleClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { Archive, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { Chat, View, WorkingDirectory } from '../../../../../src/app/types'
import { DirectoryExpandedBranchGroups } from './branch-chat-groups'
import {
  type BranchWorkspace,
  directoryBlockMatchesSearch,
  filterBranchGroups,
} from './branch-group-model'
import { DirectoryCompactBranchGroups } from './compact-branch-groups'
import { DirectoryBrandIcon } from './directory-brand-icon'
import { filterChatsBySearch, filterChatsForCurrentBranch, sortChats } from './directory-chat-model'
import { DirectoryWorkActionsMenuButton } from './directory-work-actions-menu'
import { DirectoryWorkChatRow } from './directory-work-chat-row'
import { DirectoryRenameField } from './directory-work-fields'
import { NewChatMenu } from './new-chat-menu'

function DirectoryWorkBlockHeader({
  currentBranch,
  expanded,
  isGitRepo,
  directory,
  onAction,
  onFocusDirectory,
  onToggleExpanded,
}: {
  currentBranch: string | null
  expanded: boolean
  isGitRepo: boolean
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
  onFocusDirectory: (directoryId: string) => void
  onToggleExpanded: () => void
}) {
  const [renameDraft, setRenameDraft] = useState(directory.name)
  const [editingName, setEditingName] = useState(false)
  const submitRename = () => {
    const nextName = renameDraft.trim()
    setEditingName(false)
    if (!nextName || nextName === directory.name) {
      setRenameDraft(directory.name)
      return
    }
    void onAction('directory.edit-name', { directoryId: directory.id, directoryName: nextName })
  }
  const handleHeadingClick = () => {
    onFocusDirectory(directory.id)
    onToggleExpanded()
  }

  return (
    <div className="sidebar-project-work-project-block-heading-row">
      <button
        type="button"
        className="sidebar-icon-action sidebar-icon-action--md sidebar-icon-action--no-hover sidebar-project-work-project-block-disclosure"
        onClick={handleHeadingClick}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${directory.name}` : `Expand ${directory.name}`}
      >
        <DirectoryBrandIcon directory={directory} />
      </button>
      {editingName ? (
        <div className="sidebar-project-work-project-block-heading">
          <DirectoryRenameField
            directoryName={directory.name}
            renameDraft={renameDraft}
            onCancel={() => {
              setRenameDraft(directory.name)
              setEditingName(false)
            }}
            onChange={setRenameDraft}
            onSubmit={submitRename}
          />
        </div>
      ) : (
        <button
          type="button"
          className="sidebar-project-work-project-block-heading"
          onClick={handleHeadingClick}
        >
          <span className="truncate">{directory.name}</span>
        </button>
      )}
      <DirectoryWorkActionsMenuButton
        directory={directory}
        onAction={onAction}
        onRename={() => {
          setRenameDraft(directory.name)
          setEditingName(true)
        }}
      />
      <NewChatMenu
        currentBranch={currentBranch}
        isGitRepo={isGitRepo}
        onAction={onAction}
        directoryId={directory.id}
      />
    </div>
  )
}

function NonGitDirectoryBlockChats({
  activeView,
  directory,
  searchQuery,
  selectedChatId,
  terminalRunningConversationIds,
  chats,
  onAction,
  onChatOpen,
}: {
  activeView: View
  directory: WorkingDirectory
  searchQuery: string
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  chats: Chat[]
  onAction: DesktopActionInvoker
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
}) {
  return (
    <div className="sidebar-project-work-thread-list">
      {filterChatsBySearch(sortChats(chats), searchQuery).map((chat) => (
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

function DirectoryWorkBlockActions({
  activeView,
  expanded,
  hideSessionCounts,
  isDirectoryActive,
  olderChatCount,
  selectedChatId,
  onOpenDirectorySessions,
  onOpenAutomations,
}: {
  activeView: View
  expanded: boolean
  hideSessionCounts: boolean
  isDirectoryActive: boolean
  olderChatCount: number
  selectedChatId: string | null
  onOpenDirectorySessions: () => void
  onOpenAutomations: () => void
}) {
  return (
    <div className="sidebar-project-work-project-block-actions">
      <button
        type="button"
        className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-action-row"
        data-active={activeView === 'automations' && isDirectoryActive ? 'true' : 'false'}
        onClick={onOpenAutomations}
      >
        <ChevronRight size={13} aria-hidden="true" />
        <span>Automations</span>
        <span className="sidebar-project-work-pill">Soon</span>
      </button>
      {expanded ? (
        <button
          type="button"
          className="sidebar-compact-row sidebar-compact-row--action sidebar-project-work-history-row"
          data-active={
            activeView === 'history' && isDirectoryActive && selectedChatId === null
              ? 'true'
              : 'false'
          }
          onClick={onOpenDirectorySessions}
        >
          <Archive size={14} />
          <span>Past chats</span>
          {hideSessionCounts ? null : (
            <span className={cn('sidebar-project-work-history-count', appToneSubtleClass)}>
              {olderChatCount}
            </span>
          )}
        </button>
      ) : null}
    </div>
  )
}

export function DirectoryWorkSummaryBlock({
  activeView,
  branchGroups,
  collapsedBranchIds,
  currentBranch,
  currentBranchDirty,
  expanded,
  hideSessionCounts,
  isGitRepo,
  olderChatCount,
  directory,
  searchQuery,
  selectedDirectoryId,
  selectedChatId,
  terminalRunningConversationIds,
  chats,
  unassignedCollapsed,
  onAction,
  onFocusDirectory,
  onPrimeDirectory,
  onSetCollapsedBranchIds,
  onShowView,
  onChatOpen,
  onToggleExpanded,
  onToggleUnassigned,
}: {
  activeView: View
  branchGroups: BranchWorkspace[]
  collapsedBranchIds: Record<string, boolean>
  currentBranch: string | null
  currentBranchDirty: boolean
  expanded: boolean
  hideSessionCounts: boolean
  isGitRepo: boolean
  olderChatCount: number
  directory: WorkingDirectory
  searchQuery: string
  selectedDirectoryId: string
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  chats: Chat[]
  unassignedCollapsed: boolean
  onAction: DesktopActionInvoker
  onFocusDirectory: (directoryId: string) => void
  onPrimeDirectory: (directoryId: string) => void
  onSetCollapsedBranchIds: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
  onShowView: (view: View) => void
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
  onToggleExpanded: () => void
  onToggleUnassigned: () => void
}) {
  const isDirectoryActive = selectedDirectoryId === directory.id
  const openDirectorySessions = () => {
    onPrimeDirectory(directory.id)
    onShowView('history')
    void onAction('directory.select', { directoryId: directory.id })
  }
  const openDirectoryAutomations = () => {
    onFocusDirectory(directory.id)
    onShowView('automations')
  }
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const branchChats = filterChatsBySearch(
    filterChatsForCurrentBranch(chats, currentBranch),
    searchQuery,
  )
  const unassignedChats = filterChatsBySearch(
    sortChats(chats.filter((chat) => !chat.branchName?.trim())),
    searchQuery,
  )
  const filteredBranchGroups = filterBranchGroups(branchGroups, searchQuery)
  const currentBranchWorktrees =
    filteredBranchGroups.find((group) => group.kind === 'branch' && group.current)?.worktrees ?? []
  const searchExpanded = normalizedSearchQuery.length > 0
  const unassignedExpanded = searchExpanded || !unassignedCollapsed

  if (
    !directoryBlockMatchesSearch({
      branchGroups: filteredBranchGroups,
      normalizedSearchQuery,
      directoryName: directory.name,
    })
  )
    return null

  return (
    <section className="sidebar-project-work-project-block">
      <DirectoryWorkBlockHeader
        currentBranch={currentBranch}
        expanded={expanded}
        isGitRepo={isGitRepo}
        directory={directory}
        onAction={onAction}
        onFocusDirectory={onFocusDirectory}
        onToggleExpanded={onToggleExpanded}
      />

      <DirectoryWorkBlockActions
        activeView={activeView}
        expanded={expanded}
        hideSessionCounts={hideSessionCounts}
        isDirectoryActive={isDirectoryActive}
        olderChatCount={olderChatCount}
        selectedChatId={selectedChatId}
        onOpenAutomations={openDirectoryAutomations}
        onOpenDirectorySessions={openDirectorySessions}
      />

      {isGitRepo ? (
        expanded || searchExpanded ? (
          <DirectoryExpandedBranchGroups
            activeView={activeView}
            branchGroups={filteredBranchGroups}
            collapsedBranchIds={collapsedBranchIds}
            currentBranch={currentBranch}
            currentBranchDirty={currentBranchDirty}
            hideSessionCounts={hideSessionCounts}
            normalizedSearchQuery={normalizedSearchQuery}
            directory={directory}
            selectedChatId={selectedChatId}
            terminalRunningConversationIds={terminalRunningConversationIds}
            onAction={onAction}
            onSetCollapsedBranchIds={onSetCollapsedBranchIds}
            onChatOpen={onChatOpen}
          />
        ) : (
          <DirectoryCompactBranchGroups
            activeView={activeView}
            branchChats={branchChats}
            currentBranch={currentBranch}
            currentBranchDirty={currentBranchDirty}
            currentBranchExpanded={
              normalizedSearchQuery.length > 0 ||
              !(collapsedBranchIds[`${directory.id}:current-branch`] ?? false)
            }
            hideSessionCounts={hideSessionCounts}
            directory={directory}
            selectedChatId={selectedChatId}
            terminalRunningConversationIds={terminalRunningConversationIds}
            unassignedExpanded={unassignedExpanded}
            unassignedChats={unassignedChats}
            worktrees={currentBranchWorktrees}
            onAction={onAction}
            onChatOpen={onChatOpen}
            onToggleCurrentBranch={() =>
              onSetCollapsedBranchIds((current) => ({
                ...current,
                [`${directory.id}:current-branch`]: !(
                  current[`${directory.id}:current-branch`] ?? false
                ),
              }))
            }
            onToggleUnassigned={onToggleUnassigned}
          />
        )
      ) : (
        <NonGitDirectoryBlockChats
          activeView={activeView}
          directory={directory}
          searchQuery={searchQuery}
          selectedChatId={selectedChatId}
          terminalRunningConversationIds={terminalRunningConversationIds}
          chats={expanded || searchExpanded ? chats : sortChats(chats).slice(0, 5)}
          onAction={onAction}
          onChatOpen={onChatOpen}
        />
      )}
    </section>
  )
}
