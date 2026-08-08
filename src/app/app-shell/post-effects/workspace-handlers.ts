import { hasActionError } from '../controller-action-utils'
import type { PostEffectHandler, PostEffectsContext } from './context'
import { applyDiffPreferencesPostEffect } from './diff-preferences'
import {
  applyCommitOptionsPostEffect,
  applyCreateWorktreePostEffect,
  applyRemoveWorktreePostEffect,
  applySwitchBranchPostEffect,
  applyWorkspaceCommitPostEffect,
  applyWorktreeMetadataPostEffect,
} from './workspace'

function mutationFailedWithoutChanges(ctx: PostEffectsContext) {
  return hasActionError(ctx.actionResult) && ctx.actionResult?.result?.didMutate !== true
}

export const workspacePostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => ctx.action === 'workspace.commit-options',
    run: (ctx) =>
      applyCommitOptionsPostEffect({
        contextualPayload: ctx.contextualPayload,
        refreshShellState: ctx.refreshShellState,
        loadProjectGitState: ctx.loadProjectGitState,
        setProjectGitState: ctx.setProjectGitState,
      }),
  },
  {
    matches: (ctx) =>
      ctx.action === 'workspace.switch-branch' || ctx.action === 'workspace.prune-branch',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applySwitchBranchPostEffect({
        contextualPayload: ctx.contextualPayload,
        queryClient: ctx.queryClient,
        loadProjectGitState: ctx.loadProjectGitState,
        loadProjectThreads: ctx.loadProjectThreads,
        setProjectGitState: ctx.setProjectGitState,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'workspace.create-worktree',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applyCreateWorktreePostEffect({
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadProjectGitState: ctx.loadProjectGitState,
        setProjectGitState: ctx.setProjectGitState,
      })
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'workspace.mark-worktree-complete' ||
      ctx.action === 'workspace.mark-worktree-incomplete' ||
      ctx.action === 'workspace.set-worktree-directory',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applyWorktreeMetadataPostEffect({
        action: ctx.action,
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadProjectGitState: ctx.loadProjectGitState,
        setProjectGitState: ctx.setProjectGitState,
      })
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'workspace.remove-worktree' ||
      ctx.action === 'workspace.merge-worktree' ||
      ctx.action === 'workspace.merge-completed-worktrees' ||
      ctx.action === 'workspace.remove-completed-worktrees',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applyRemoveWorktreePostEffect({
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadProjectGitState: ctx.loadProjectGitState,
        setProjectGitState: ctx.setProjectGitState,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'workspace.diff-preferences',
    run: (ctx) => {
      if (hasActionError(ctx.actionResult)) return
      return applyDiffPreferencesPostEffect({
        contextualPayload: ctx.contextualPayload,
        queryClient: ctx.queryClient,
        setLiveThreadData: ctx.setLiveThreadData,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'workspace.commit',
    run: (ctx) =>
      applyWorkspaceCommitPostEffect({
        contextualPayload: ctx.contextualPayload,
        committed: ctx.actionResult?.result?.committed === true,
        queryClient: ctx.queryClient,
        loadProjectGitState: ctx.loadProjectGitState,
        setProjectGitState: ctx.setProjectGitState,
      }),
  },
]
