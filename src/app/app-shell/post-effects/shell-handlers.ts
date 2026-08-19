import type { ShellState } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import {
  setShellSidebarVisibleProjectIds,
  updateShellProject,
  upsertShellProject,
} from '../project-shell-cache'
import type { PostEffectHandler } from './context'
import { applyNewThreadPostEffect } from './new-thread'

export const shellPostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => Boolean(ctx.actionResult?.result?.composer),
    run: (ctx) => {
      if (ctx.actionResult?.result?.composer) ctx.setComposerState(ctx.actionResult.result.composer)
    },
  },
  {
    matches: (ctx) => ctx.action === 'project.refresh-repo-origin',
    run: (ctx) => {
      const projectId = ctx.actionResult?.result?.projectId ?? ctx.contextualPayload.projectId
      const originUrl = ctx.actionResult?.result?.originUrl
      if (typeof projectId !== 'string') return
      updateShellProject(ctx.queryClient, projectId, (project) =>
        project.repoOriginUrl === originUrl && project.repoOriginChecked === true
          ? project
          : { ...project, repoOriginUrl: originUrl ?? null, repoOriginChecked: true },
      )
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'pi-settings.update' && ctx.contextualPayload.piSettingsKey === 'theme',
    run: (ctx) => {
      const { piSettings, piTheme } = ctx.actionResult?.result ?? {}
      if (!(piSettings && piTheme)) return ctx.refreshShellState()
      ctx.queryClient.setQueryData<ShellState | null>(
        desktopQueryKeys.shellState(),
        (currentState) => (currentState ? { ...currentState, piSettings, piTheme } : currentState),
      )
    },
  },
  {
    matches: (ctx) => ctx.action === 'project.pin',
    run: (ctx) => {
      const projectId =
        typeof ctx.contextualPayload.projectId === 'string' ? ctx.contextualPayload.projectId : null
      if (!projectId) return
      updateShellProject(ctx.queryClient, projectId, (project) => ({
        ...project,
        pinned: !project.pinned,
      }))
    },
  },
  {
    matches: (ctx) => ctx.action === 'thread.new' || ctx.action === 'project.add',
    run: (ctx) => {
      if (ctx.action !== 'thread.new' && ctx.action !== 'project.add') return
      return applyNewThreadPostEffect({
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
    },
  },
  {
    matches: (ctx) => ctx.action === 'workspace.sidebar-scope',
    run: (ctx) => {
      const projectIds = Array.isArray(ctx.contextualPayload.projectIds)
        ? ctx.contextualPayload.projectIds.filter(
            (projectId): projectId is string => typeof projectId === 'string',
          )
        : []
      setShellSidebarVisibleProjectIds(ctx.queryClient, projectIds)
    },
  },
  {
    matches: (ctx) => ctx.action === 'projects.import.apply',
    run: async (ctx) => {
      const importedProjects = ctx.actionResult?.result?.importedProjects
      if (!Array.isArray(importedProjects)) {
        await ctx.refreshShellState()
        return
      }
      for (const project of importedProjects) upsertShellProject(ctx.queryClient, project)
    },
  },
]
