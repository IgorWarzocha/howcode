import type { QueryClient } from '@tanstack/react-query'
import type { Dispatch } from 'react'
import type { DesktopAction } from '../desktop/actions'
import type {
  ArchivedThread,
  ChatSidebarState,
  ComposerState,
  DesktopActionResult,
  ProjectGitState,
  ThreadData,
} from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import { type ActionPayload, hasActionError } from './controller-action-utils'
import { applyDiffPreferencesPostEffect } from './post-effects/diff-preferences'
import { applyNewThreadPostEffect } from './post-effects/new-thread'
import {
  applyArchivedThreadPostEffect,
  applyProjectArchiveThreadsPostEffect,
  applyProjectRemovePostEffect,
  applyRestoreOrDeleteThreadPostEffect,
  applyThreadOpenOrInboxPostEffect,
  refreshArchivedIfVisible,
} from './post-effects/thread-lifecycle'
import {
  applyCommitOptionsPostEffect,
  applyCreateWorktreePostEffect,
  applySwitchBranchPostEffect,
  applyWorkspaceCommitPostEffect,
} from './post-effects/workspace'
import { reconcileComposerThreadResult } from './sidebar-thread-sync'

export {
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedPiSettingsState,
  getOptimisticallyUpdatedShellState,
} from './controller-optimistic-updates'
export { applyDiffPreferencesToThread } from './post-effects/diff-preferences'

type RunPostDesktopActionEffectsInput = {
  action: DesktopAction
  contextualPayload: ActionPayload
  actionResult: DesktopActionResult | null
  workspaceState: WorkspaceState
  composerProjectId: string
  dispatch: Dispatch<WorkspaceAction>
  loadArchivedThreads: () => Promise<ArchivedThread[]>
  loadComposerState: (request?: {
    projectId?: string | null
    composerMode?: 'chat' | 'code' | null
  }) => Promise<ComposerState | null>
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>
  loadProjectThreads: (
    projectId: string,
    options?: { chat?: boolean; replaceLocalDraftSessionPath?: string | null },
  ) => Promise<unknown>
  refreshShellState: () => Promise<unknown>
  setArchivedThreads: (threads: ArchivedThread[]) => void
  setChatSidebarState: (
    updater: (state: ChatSidebarState | null) => ChatSidebarState | null,
  ) => void
  setComposerState: (state: ComposerState | null) => void
  setLiveThreadData: (updater: (state: ThreadData | null) => ThreadData | null) => void
  setProjectGitState: (state: ProjectGitState | null) => void
  queryClient: QueryClient
}

type PostEffectsContext = RunPostDesktopActionEffectsInput & {
  invalidateInboxThreads: () => Promise<unknown>
}

function getThreadLifecycleInput(ctx: PostEffectsContext) {
  return {
    action: ctx.action,
    contextualPayload: ctx.contextualPayload,
    actionResult: ctx.actionResult,
    workspaceState: ctx.workspaceState,
    queryClient: ctx.queryClient,
    dispatch: ctx.dispatch,
    loadArchivedThreads: ctx.loadArchivedThreads,
    loadProjectThreads: ctx.loadProjectThreads,
    refreshShellState: ctx.refreshShellState,
    setArchivedThreads: ctx.setArchivedThreads,
    invalidateInboxThreads: ctx.invalidateInboxThreads,
  }
}

async function handleArchivedThreadEffects(ctx: PostEffectsContext) {
  await applyArchivedThreadPostEffect(getThreadLifecycleInput(ctx))
}

async function handleRestoreOrDeleteThreadEffects(ctx: PostEffectsContext) {
  await applyRestoreOrDeleteThreadPostEffect(getThreadLifecycleInput(ctx))
}

async function handleThreadOpenOrInboxEffects(ctx: PostEffectsContext) {
  await applyThreadOpenOrInboxPostEffect(getThreadLifecycleInput(ctx))
}

async function handleProjectArchiveThreadsEffects(ctx: PostEffectsContext) {
  await applyProjectArchiveThreadsPostEffect(getThreadLifecycleInput(ctx))
}

async function handleProjectRemoveEffects(ctx: PostEffectsContext) {
  await applyProjectRemovePostEffect({
    ...getThreadLifecycleInput(ctx),
    hasActionError: hasActionError(ctx.actionResult),
  })
}

async function handleNewThreadOrProjectEffects(ctx: PostEffectsContext) {
  if (ctx.action !== 'thread.new' && ctx.action !== 'project.add') return
  await applyNewThreadPostEffect({
    action: ctx.action,
    contextualPayload: ctx.contextualPayload,
    actionResult: ctx.actionResult,
    workspaceState: ctx.workspaceState,
    composerProjectId: ctx.composerProjectId,
    queryClient: ctx.queryClient,
    dispatch: ctx.dispatch,
    refreshShellState: ctx.refreshShellState,
    loadProjectThreads: ctx.loadProjectThreads,
    loadComposerState: ctx.loadComposerState,
    setComposerState: ctx.setComposerState,
  })
}

async function handleDiffPreferencesEffects(ctx: PostEffectsContext) {
  if (hasActionError(ctx.actionResult)) return
  await applyDiffPreferencesPostEffect({
    contextualPayload: ctx.contextualPayload,
    queryClient: ctx.queryClient,
    setLiveThreadData: ctx.setLiveThreadData,
  })
}

async function handleWorkspaceCommitEffects(ctx: PostEffectsContext) {
  await applyWorkspaceCommitPostEffect({
    contextualPayload: ctx.contextualPayload,
    committed: ctx.actionResult?.result?.committed === true,
    queryClient: ctx.queryClient,
    loadProjectGitState: ctx.loadProjectGitState,
    setProjectGitState: ctx.setProjectGitState,
  })
}

async function handleCommitOptionsEffects(ctx: PostEffectsContext) {
  await applyCommitOptionsPostEffect({
    contextualPayload: ctx.contextualPayload,
    refreshShellState: ctx.refreshShellState,
    loadProjectGitState: ctx.loadProjectGitState,
    setProjectGitState: ctx.setProjectGitState,
  })
}

async function handleSwitchBranchEffects(ctx: PostEffectsContext) {
  if (hasActionError(ctx.actionResult) && ctx.actionResult?.result?.didMutate !== true) return
  await applySwitchBranchPostEffect({
    contextualPayload: ctx.contextualPayload,
    queryClient: ctx.queryClient,
    loadProjectGitState: ctx.loadProjectGitState,
    loadProjectThreads: ctx.loadProjectThreads,
    setProjectGitState: ctx.setProjectGitState,
  })
}

async function handleCreateWorktreeEffects(ctx: PostEffectsContext) {
  if (hasActionError(ctx.actionResult) && ctx.actionResult?.result?.didMutate !== true) return
  await applyCreateWorktreePostEffect({
    contextualPayload: ctx.contextualPayload,
    actionResult: ctx.actionResult,
    queryClient: ctx.queryClient,
    loadProjectGitState: ctx.loadProjectGitState,
    loadProjectThreads: ctx.loadProjectThreads,
    refreshShellState: ctx.refreshShellState,
    setProjectGitState: ctx.setProjectGitState,
  })
}

type PostEffectHandler = {
  matches: (ctx: PostEffectsContext) => boolean
  run: (ctx: PostEffectsContext) => Promise<void> | void
}

const postEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) =>
      ctx.action === 'thread.pin' ||
      ctx.action === 'thread.archive' ||
      ctx.action === 'thread.archive-many' ||
      ctx.action === 'thread.assign-branch',
    run: handleArchivedThreadEffects,
  },
  {
    matches: (ctx) =>
      ctx.action === 'thread.restore' ||
      ctx.action === 'thread.restore-many' ||
      ctx.action === 'thread.delete' ||
      ctx.action === 'thread.delete-many',
    run: handleRestoreOrDeleteThreadEffects,
  },
  {
    matches: (ctx) =>
      ctx.action === 'thread.open' ||
      ctx.action === 'inbox.mark-read' ||
      ctx.action === 'inbox.dismiss' ||
      ctx.action === 'inbox.clear-read',
    run: handleThreadOpenOrInboxEffects,
  },
  {
    matches: (ctx) => ctx.action === 'project.edit-name',
    run: async (ctx) => {
      await ctx.refreshShellState()
      await refreshArchivedIfVisible(getThreadLifecycleInput(ctx))
    },
  },
  {
    matches: (ctx) => ctx.action === 'project.refresh-repo-origin',
    run: (ctx) => ctx.refreshShellState(),
  },
  {
    matches: (ctx) =>
      ctx.action === 'pi-settings.update' && ctx.contextualPayload.piSettingsKey === 'theme',
    run: (ctx) => ctx.refreshShellState(),
  },
  { matches: (ctx) => ctx.action === 'project.pin', run: (ctx) => ctx.refreshShellState() },
  {
    matches: (ctx) => ctx.action === 'project.archive-threads',
    run: handleProjectArchiveThreadsEffects,
  },
  { matches: (ctx) => ctx.action === 'project.remove-project', run: handleProjectRemoveEffects },
  {
    matches: (ctx) => ctx.action === 'composer.send',
    run: (ctx) =>
      reconcileComposerThreadResult({
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        workspaceState: ctx.workspaceState,
        queryClient: ctx.queryClient,
        dispatch: ctx.dispatch,
        setChatSidebarState: ctx.setChatSidebarState,
        setLiveThreadData: ctx.setLiveThreadData,
      }),
  },
  {
    matches: (ctx) => ctx.action === 'thread.new' || ctx.action === 'project.add',
    run: handleNewThreadOrProjectEffects,
  },
  { matches: (ctx) => ctx.action === 'workspace.commit-options', run: handleCommitOptionsEffects },
  {
    matches: (ctx) => ctx.action === 'workspace.sidebar-scope',
    run: (ctx) => ctx.refreshShellState(),
  },
  {
    matches: (ctx) =>
      ctx.action === 'workspace.switch-branch' || ctx.action === 'workspace.prune-branch',
    run: handleSwitchBranchEffects,
  },
  {
    matches: (ctx) =>
      ctx.action === 'workspace.create-worktree' ||
      ctx.action === 'workspace.remove-worktree' ||
      ctx.action === 'workspace.mark-worktree-complete' ||
      ctx.action === 'workspace.mark-worktree-incomplete' ||
      ctx.action === 'workspace.merge-worktree' ||
      ctx.action === 'workspace.merge-completed-worktrees' ||
      ctx.action === 'workspace.remove-completed-worktrees',
    run: handleCreateWorktreeEffects,
  },
  {
    matches: (ctx) => ctx.action === 'workspace.diff-preferences',
    run: handleDiffPreferencesEffects,
  },
  { matches: (ctx) => ctx.action === 'workspace.commit', run: handleWorkspaceCommitEffects },
  {
    matches: (ctx) =>
      ctx.action === 'projects.import.apply' || ctx.action === 'workspace.set-worktree-directory',
    run: (ctx) => ctx.refreshShellState(),
  },
]

export async function runPostDesktopActionEffects(input: RunPostDesktopActionEffectsInput) {
  const ctx: PostEffectsContext = {
    ...input,
    invalidateInboxThreads: () =>
      input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  }

  for (const handler of postEffectHandlers) {
    if (handler.matches(ctx)) await handler.run(ctx)
  }
}
