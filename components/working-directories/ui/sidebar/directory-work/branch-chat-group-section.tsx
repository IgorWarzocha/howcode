import { CircleOff, GitBranch, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { ActivitySpinner } from '../../../../../src/app/common/activity-spinner'
import { Tooltip } from '../../../../../src/app/common/tooltip'
import { SidebarActionTooltip } from '../../../../../src/app/components/sidebar/sidebar-action-tooltip'
import type { DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { View, WorkingDirectory } from '../../../../../src/app/types'
import { WorktreeSmallIcon } from '../../../../../src/app/ui/icons/worktree-small-icon'
import {
  type BranchActionCapabilities,
  getBranchActionCapabilities,
} from './branch-action-capabilities'
import type { BranchWorkspace } from './branch-group-model'
import { BranchInlineActions, BranchSessionCount } from './branch-row-actions'
import { DirectoryWorkChatRow } from './directory-work-chat-row'
import { createChatForBranch } from './new-chat-actions'
import { getDesktopBranchActionFailure, useBranchActionExecution } from './useBranchActionExecution'
import { WorktreeGroupSection } from './worktree-group-section'

const dirtyBranchSwitchMessage = 'Worktree is dirty. Commit first.'

function BranchHeadingIcon({ group }: { group: BranchWorkspace }) {
  if (group.kind === 'unassigned') {
    return <CircleOff size={13} className="sidebar-project-work-unassigned-icon" />
  }
  if (group.kind === 'worktree') {
    return <WorktreeSmallIcon size={13} className="sidebar-project-work-branch-icon" />
  }
  return <GitBranch size={13} className="sidebar-project-work-branch-icon" />
}

function BranchHeadingRow({ children, unassigned }: { children: ReactNode; unassigned: boolean }) {
  const row = (
    <div className="sidebar-compact-row sidebar-compact-row--branch sidebar-project-work-branch-heading">
      {children}
    </div>
  )
  if (!unassigned) return row
  return (
    <Tooltip
      content="Chats not assigned to a git branch"
      className="sidebar-project-work-row-tooltip"
    >
      {row}
    </Tooltip>
  )
}

function getChatAssignBranchForGroup(group: BranchWorkspace, currentBranch: string | null) {
  if (group.kind !== 'worktree') return currentBranch
  return group.worktreeBranchName
}

function getBranchGroupDividerState(input: {
  collapsed: boolean
  showBottomDivider: boolean
  showTopDivider: boolean
}) {
  if (input.collapsed) return { before: 'false', after: 'false' }
  return {
    before: input.showTopDivider ? 'true' : 'false',
    after: input.showBottomDivider ? 'true' : 'false',
  }
}

function getBranchGroupVisibilityState(group: BranchWorkspace) {
  const canToggleChats = group.chats.length > 0
  const hasWorktrees = group.worktrees.length > 0
  const emptySwitchableBranch = group.kind === 'branch' && !group.current
  const showEmptyBranchPrompt = !(canToggleChats || hasWorktrees) && emptySwitchableBranch
  return {
    canToggleGroup: canToggleChats || hasWorktrees || emptySwitchableBranch,
    showContents: canToggleChats || hasWorktrees || showEmptyBranchPrompt,
    showEmptyBranchPrompt,
  }
}

function EmptyBranchPrompt({
  currentBranchDirty,
  group,
  directory,
  onAction,
}: {
  currentBranchDirty: boolean
  group: BranchWorkspace
  directory: WorkingDirectory
  onAction: DesktopActionInvoker
}) {
  const execution = useBranchActionExecution()
  const warning = execution.warning ?? (currentBranchDirty ? dirtyBranchSwitchMessage : null)
  const switchAndCreateChat = async () => {
    execution.clearWarning()
    await execution.run({
      execute: async () => {
        const switchResult = await onAction('git.switch-branch', {
          directoryId: directory.id,
          value: group.label,
        })
        const switchFailure = getDesktopBranchActionFailure(
          switchResult,
          'Could not switch branch.',
        )
        if (switchFailure) return { failure: switchFailure }
        const chatResult = await createChatForBranch({
          branchName: group.label,
          onAction,
          directoryId: directory.id,
        })
        return {
          failure: getDesktopBranchActionFailure(chatResult, 'Could not start a new chat.'),
        }
      },
      getFailure: (result) => result.failure,
    })
  }
  return (
    <div className="sidebar-project-work-empty-branch-row">
      <span className="sidebar-project-work-empty-branch-spacer" aria-hidden="true" />
      <span>No chats in this branch.</span>
      <SidebarActionTooltip description="Switch branches and start a new chat." warning={warning}>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--sm sidebar-project-work-branch-action sidebar-project-work-branch-action--optical-up sidebar-project-work-empty-start"
          data-warning={warning ? 'true' : 'false'}
          disabled={execution.pending}
          onClick={(event) => {
            event.stopPropagation()
            if (currentBranchDirty) return
            void switchAndCreateChat()
          }}
          aria-label="Switch branches and start a new chat"
        >
          {execution.pending ? (
            <ActivitySpinner className="h-3 w-3 text-current" />
          ) : (
            <Plus size={12} />
          )}
        </button>
      </SidebarActionTooltip>
    </div>
  )
}

export function BranchWorkspaceSection({
  actionCapabilityOverrides,
  activeView,
  collapsed,
  currentBranch,
  currentBranchDirty = false,
  group,
  hideSessionCounts,
  directory,
  selectedChatId,
  terminalRunningConversationIds,
  onAction,
  showBottomDivider = false,
  showTopDivider = false,
  onChatOpen,
  onToggle,
}: {
  actionCapabilityOverrides?: Partial<BranchActionCapabilities>
  activeView: View
  collapsed: boolean
  currentBranch: string | null
  currentBranchDirty?: boolean
  group: BranchWorkspace
  hideSessionCounts: boolean
  directory: WorkingDirectory
  selectedChatId: string | null
  terminalRunningConversationIds: ReadonlySet<string>
  onAction: DesktopActionInvoker
  showBottomDivider?: boolean
  showTopDivider?: boolean
  onChatOpen: (directoryId: string, chatId: string, conversationId: string) => void
  onToggle: () => void
}) {
  const visibilityState = getBranchGroupVisibilityState(group)
  const actionCapabilities = getBranchActionCapabilities(group, {
    canStartChat: !visibilityState.showEmptyBranchPrompt,
    ...actionCapabilityOverrides,
  })
  const branchSwitchBlocked = actionCapabilities.canSwitch && currentBranchDirty
  const chatDirectory =
    group.kind === 'worktree' ? { ...directory, id: group.worktreePath } : directory
  const chatAssignBranch = getChatAssignBranchForGroup(group, currentBranch)
  const dividerState = getBranchGroupDividerState({
    collapsed,
    showBottomDivider,
    showTopDivider,
  })

  return (
    <section
      className="sidebar-project-work-branch-group"
      data-branch-group-kind={group.kind}
      data-current={
        (group.kind === 'branch' && group.current) ||
        (group.kind === 'worktree' && !group.worktreeComplete)
          ? 'true'
          : 'false'
      }
      data-divider-after={dividerState.after}
      data-divider-before={dividerState.before}
    >
      <BranchHeadingRow unassigned={group.kind === 'unassigned'}>
        <button
          type="button"
          className="sidebar-icon-action sidebar-icon-action--xs sidebar-icon-action--no-hover sidebar-project-work-branch-disclosure"
          onClick={onToggle}
          disabled={!visibilityState.canToggleGroup}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
        >
          <BranchHeadingIcon group={group} />
        </button>
        <button
          type="button"
          className="sidebar-project-work-branch-toggle"
          onClick={onToggle}
          disabled={!visibilityState.canToggleGroup}
          aria-expanded={!collapsed}
        >
          <span className="truncate">{group.label}</span>
        </button>
        <span className="sidebar-project-work-branch-meta">
          {group.kind === 'branch' && group.current ? (
            <span className="sidebar-project-work-branch-current">Current</span>
          ) : null}
          <BranchSessionCount count={group.chats.length} hidden={hideSessionCounts} />
        </span>
        <BranchInlineActions
          capabilities={actionCapabilities}
          currentBranch={currentBranch}
          group={group}
          directory={directory}
          switchBlocked={branchSwitchBlocked}
          onAction={onAction}
        />
      </BranchHeadingRow>

      {collapsed || !visibilityState.showContents ? null : (
        <div className="sidebar-project-work-branch-contents">
          {group.chats.length > 0 ? (
            <div className="sidebar-project-work-branch-thread-list">
              {group.chats.map((chat) => (
                <DirectoryWorkChatRow
                  key={chat.id}
                  activeView={activeView}
                  directory={chatDirectory}
                  selectedChatId={selectedChatId}
                  terminalRunningConversationIds={terminalRunningConversationIds}
                  chat={chat}
                  onAction={onAction}
                  onChatOpen={onChatOpen}
                  currentBranch={chatAssignBranch}
                />
              ))}
            </div>
          ) : null}
          {group.worktrees.map((worktree, index) => (
            <WorktreeGroupSection
              key={worktree.id}
              activeView={activeView}
              currentBranch={currentBranch}
              hideSessionCounts={hideSessionCounts}
              isLast={index === group.worktrees.length - 1}
              directory={directory}
              selectedChatId={selectedChatId}
              terminalRunningConversationIds={terminalRunningConversationIds}
              worktree={worktree}
              onAction={onAction}
              onChatOpen={onChatOpen}
            />
          ))}
          {visibilityState.showEmptyBranchPrompt ? (
            <EmptyBranchPrompt
              currentBranchDirty={currentBranchDirty}
              group={group}
              directory={directory}
              onAction={onAction}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
