import type { ThreadData } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import { hasActionError } from '../controller-action-utils'
import { updateShellProject } from '../project-shell-cache'
import { reconcileComposerThreadResult } from '../sidebar-thread-sync'
import type { PostEffectHandler, PostEffectsContext } from './context'
import {
  applyArchivedThreadPostEffect,
  applyProjectArchiveThreadsPostEffect,
  applyProjectRemovePostEffect,
  applyRestoreOrDeleteThreadPostEffect,
  applyThreadOpenOrInboxPostEffect,
  refreshArchivedIfVisible,
} from './thread-lifecycle'

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

function getThreadRenameContext(ctx: PostEffectsContext) {
  const result = ctx.actionResult?.result
  return {
    projectId:
      typeof result?.projectId === 'string'
        ? result.projectId
        : typeof ctx.contextualPayload.projectId === 'string'
          ? ctx.contextualPayload.projectId
          : null,
    sessionPath:
      typeof result?.sessionPath === 'string'
        ? result.sessionPath
        : typeof ctx.contextualPayload.sessionPath === 'string'
          ? ctx.contextualPayload.sessionPath
          : null,
    threadId:
      typeof result?.threadId === 'string'
        ? result.threadId
        : typeof ctx.contextualPayload.threadId === 'string'
          ? ctx.contextualPayload.threadId
          : null,
    title:
      typeof result?.title === 'string'
        ? result.title
        : typeof ctx.contextualPayload.value === 'string'
          ? ctx.contextualPayload.value.trim()
          : '',
  }
}

function isRenamedThread(
  thread: { id: string; sessionPath?: string | null | undefined },
  input: { threadId: string; sessionPath: string | null },
) {
  return thread.id === input.threadId || thread.sessionPath === input.sessionPath
}

function renameCachedProjectThreads(
  ctx: PostEffectsContext,
  input: { projectId: string; sessionPath: string | null; threadId: string; title: string },
) {
  for (const chat of [false, true]) {
    ctx.queryClient.setQueryData<{ id: string; sessionPath?: string | null; title: string }[]>(
      desktopQueryKeys.projectThreads(input.projectId, chat),
      (current) =>
        current?.map((thread) =>
          isRenamedThread(thread, input) ? { ...thread, title: input.title } : thread,
        ),
    )
  }
}

async function handleThreadRenameEffects(ctx: PostEffectsContext) {
  const { projectId, sessionPath, threadId, title } = getThreadRenameContext(ctx)
  if (hasActionError(ctx.actionResult)) {
    if (projectId) {
      await Promise.all([
        ctx.loadProjectThreads(projectId),
        ctx.loadProjectThreads(projectId, { chat: true }),
      ])
    }
    return
  }
  if (!(threadId && title)) return

  if (projectId) {
    updateShellProject(ctx.queryClient, projectId, (project) => ({
      ...project,
      threads: project.threads.map((thread) =>
        thread.id === threadId ? { ...thread, title } : thread,
      ),
    }))
    renameCachedProjectThreads(ctx, { projectId, sessionPath, threadId, title })
  }

  ctx.setChatSidebarState((currentState) =>
    currentState
      ? {
          ...currentState,
          ungroupedThreads: currentState.ungroupedThreads.map((thread) =>
            isRenamedThread(thread, { threadId, sessionPath }) ? { ...thread, title } : thread,
          ),
          groups: currentState.groups.map((group) => ({
            ...group,
            threads: group.threads.map((thread) =>
              isRenamedThread(thread, { threadId, sessionPath }) ? { ...thread, title } : thread,
            ),
          })),
        }
      : currentState,
  )

  ctx.setLiveThreadData((current) =>
    current && (!sessionPath || current.sessionPath === sessionPath)
      ? { ...current, title }
      : current,
  )
  if (sessionPath) {
    ctx.queryClient.setQueriesData<ThreadData | null>(
      { queryKey: desktopQueryKeys.threadPrefix(sessionPath) },
      (current) => (current ? { ...current, title } : current),
    )
  }
  await ctx.invalidateInboxThreads()
}

export const threadPostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) =>
      ctx.action === 'thread.pin' ||
      ctx.action === 'thread.archive' ||
      ctx.action === 'thread.archive-many' ||
      ctx.action === 'thread.assign-branch',
    run: (ctx) => applyArchivedThreadPostEffect(getThreadLifecycleInput(ctx)),
  },
  {
    matches: (ctx) =>
      ctx.action === 'thread.restore' ||
      ctx.action === 'thread.restore-many' ||
      ctx.action === 'thread.delete' ||
      ctx.action === 'thread.delete-many',
    run: (ctx) => applyRestoreOrDeleteThreadPostEffect(getThreadLifecycleInput(ctx)),
  },
  {
    matches: (ctx) =>
      ctx.action === 'thread.open' ||
      ctx.action === 'inbox.mark-read' ||
      ctx.action === 'inbox.dismiss' ||
      ctx.action === 'inbox.clear-read',
    run: (ctx) => applyThreadOpenOrInboxPostEffect(getThreadLifecycleInput(ctx)),
  },
  { matches: (ctx) => ctx.action === 'thread.rename', run: handleThreadRenameEffects },
  {
    matches: (ctx) => ctx.action === 'project.archive-threads',
    run: (ctx) => applyProjectArchiveThreadsPostEffect(getThreadLifecycleInput(ctx)),
  },
  {
    matches: (ctx) => ctx.action === 'project.remove-project',
    run: (ctx) =>
      applyProjectRemovePostEffect({
        ...getThreadLifecycleInput(ctx),
        hasActionError: hasActionError(ctx.actionResult),
      }),
  },
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
    matches: (ctx) => ctx.action === 'project.edit-name',
    run: async (ctx) => {
      const projectId =
        typeof ctx.contextualPayload.projectId === 'string' ? ctx.contextualPayload.projectId : null
      const projectName =
        typeof ctx.contextualPayload.projectName === 'string'
          ? ctx.contextualPayload.projectName
          : null
      if (projectId && projectName) {
        updateShellProject(ctx.queryClient, projectId, (project) =>
          project.name === projectName ? project : { ...project, name: projectName },
        )
      }
      await refreshArchivedIfVisible(getThreadLifecycleInput(ctx))
    },
  },
]
