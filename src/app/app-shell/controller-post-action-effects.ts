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
import { refreshArchivedThreadsIfOpen } from './controller-action-helpers'
import {
  type ActionPayload,
  getPayloadProjectId,
  getPayloadProjectIds,
  getPayloadThreadIds,
  getResultThreadIds,
  hasActionError,
  isThreadList,
} from './controller-action-utils'
import { applyDiffPreferencesPostEffect } from './post-effects/diff-preferences'
import { applyNewThreadPostEffect } from './post-effects/new-thread'
import {
  applyCommitOptionsPostEffect,
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
  loadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
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

function getPayloadThreadId(payload: ActionPayload) {
  return typeof payload.threadId === 'string' ? payload.threadId : null
}

function clearSelectedThreadIfIncluded(ctx: PostEffectsContext, threadIds: string[]) {
  const selectedThreadId = ctx.workspaceState.selectedThreadId
  if (!(selectedThreadId && new Set(threadIds).has(selectedThreadId))) return
  ctx.dispatch({ type: 'clear-thread-selection' })
  ctx.dispatch({
    type: 'show-view',
    view: ctx.workspaceState.activeView === 'chat' ? 'chat' : 'code',
  })
}

async function invalidateProjectUsage(ctx: PostEffectsContext, projectIds: string[]) {
  const uniqueProjectIds = [...new Set(projectIds.filter((projectId) => projectId.length > 0))]
  await Promise.all(
    uniqueProjectIds.map((projectId) =>
      ctx.queryClient.invalidateQueries({
        queryKey: desktopQueryKeys.projectUsageSummary(projectId),
      }),
    ),
  )
}

async function handleArchivedThreadEffects(ctx: PostEffectsContext) {
  const projectId = getPayloadProjectId(ctx.contextualPayload)
  if (projectId) await ctx.loadProjectThreads(projectId)
  if (projectId) await invalidateProjectUsage(ctx, [projectId])
  if (ctx.action === 'thread.archive' || ctx.action === 'thread.archive-many') {
    await refreshArchivedThreadsIfOpen({
      archivedThreadsVisible: ctx.workspaceState.activeView === 'archived',
      loadArchivedThreads: ctx.loadArchivedThreads,
      setArchivedThreads: ctx.setArchivedThreads,
    })
  }
  const archivedThreadIds =
    ctx.action === 'thread.archive'
      ? [getPayloadThreadId(ctx.contextualPayload)].filter((threadId) => threadId !== null)
      : ctx.action === 'thread.archive-many'
        ? getPayloadThreadIds(ctx.contextualPayload)
        : []
  clearSelectedThreadIfIncluded(ctx, archivedThreadIds)
  await ctx.invalidateInboxThreads()
}

async function refreshMutatedThreadProjects(ctx: PostEffectsContext) {
  const projectId = getPayloadProjectId(ctx.contextualPayload)
  if (ctx.action === 'thread.restore-many' || ctx.action === 'thread.delete-many') {
    await ctx.refreshShellState()
    const projectIds = [...new Set(getPayloadProjectIds(ctx.contextualPayload))]
    if (projectIds.length > 0) await Promise.all(projectIds.map((id) => ctx.loadProjectThreads(id)))
    await invalidateProjectUsage(ctx, projectIds)
    return
  }
  if (projectId) await ctx.loadProjectThreads(projectId)
  if (projectId) await invalidateProjectUsage(ctx, [projectId])
}

function getDeletedThreadIds(ctx: PostEffectsContext) {
  if (ctx.action === 'thread.delete')
    return [getPayloadThreadId(ctx.contextualPayload)].filter((threadId) => threadId !== null)
  if (ctx.action !== 'thread.delete-many') return []
  const deletedBatchThreadIds = getResultThreadIds(ctx.actionResult?.result?.deletedThreadIds)
  return deletedBatchThreadIds.length > 0
    ? deletedBatchThreadIds
    : getPayloadThreadIds(ctx.contextualPayload)
}

async function handleRestoreOrDeleteThreadEffects(ctx: PostEffectsContext) {
  await refreshMutatedThreadProjects(ctx)
  ctx.setArchivedThreads(await ctx.loadArchivedThreads())
  clearSelectedThreadIfIncluded(ctx, getDeletedThreadIds(ctx))
  await ctx.invalidateInboxThreads()
}

async function handleThreadOpenOrInboxEffects(ctx: PostEffectsContext) {
  const projectId = getPayloadProjectId(ctx.contextualPayload)
  if (projectId) await ctx.loadProjectThreads(projectId)
  await ctx.invalidateInboxThreads()
}

async function refreshArchivedIfVisible(ctx: PostEffectsContext) {
  await refreshArchivedThreadsIfOpen({
    archivedThreadsVisible: ctx.workspaceState.activeView === 'archived',
    loadArchivedThreads: ctx.loadArchivedThreads,
    setArchivedThreads: ctx.setArchivedThreads,
  })
}

async function handleProjectArchiveThreadsEffects(ctx: PostEffectsContext) {
  const projectId = getPayloadProjectId(ctx.contextualPayload)
  if (projectId) await ctx.loadProjectThreads(projectId)
  if (projectId) await invalidateProjectUsage(ctx, [projectId])
  await ctx.refreshShellState()
  await refreshArchivedIfVisible(ctx)
  if (ctx.contextualPayload.projectId === ctx.workspaceState.selectedProjectId)
    ctx.dispatch({ type: 'show-view', view: 'code' })
  await ctx.invalidateInboxThreads()
}

async function handleErroredProjectRemoval(ctx: PostEffectsContext) {
  if (ctx.actionResult?.result?.didMutate !== true) return false
  const projectId = getPayloadProjectId(ctx.contextualPayload)
  await ctx.refreshShellState()
  const refreshedThreads = projectId ? await ctx.loadProjectThreads(projectId) : null
  const selectedThreadId = ctx.workspaceState.selectedThreadId
  if (
    projectId === ctx.workspaceState.selectedProjectId &&
    selectedThreadId &&
    isThreadList(refreshedThreads) &&
    !refreshedThreads.some((thread) => thread.id === selectedThreadId)
  ) {
    ctx.dispatch({ type: 'show-view', view: 'code' })
  }
  await refreshArchivedIfVisible(ctx)
  await ctx.invalidateInboxThreads()
  return true
}

async function handleProjectRemoveEffects(ctx: PostEffectsContext) {
  if (hasActionError(ctx.actionResult)) {
    await handleErroredProjectRemoval(ctx)
    return
  }
  if (ctx.contextualPayload.projectId === ctx.workspaceState.selectedProjectId)
    ctx.dispatch({ type: 'show-view', view: 'code' })
  await ctx.refreshShellState()
  await refreshArchivedIfVisible(ctx)
  await ctx.invalidateInboxThreads()
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

type PostEffectHandler = {
  matches: (ctx: PostEffectsContext) => boolean
  run: (ctx: PostEffectsContext) => Promise<void> | void
}

const postEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) =>
      ctx.action === 'thread.pin' ||
      ctx.action === 'thread.archive' ||
      ctx.action === 'thread.archive-many',
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
      await refreshArchivedIfVisible(ctx)
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
    matches: (ctx) => ctx.action === 'workspace.diff-preferences',
    run: handleDiffPreferencesEffects,
  },
  { matches: (ctx) => ctx.action === 'workspace.commit', run: handleWorkspaceCommitEffects },
  {
    matches: (ctx) => ctx.action === 'projects.import.apply',
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
