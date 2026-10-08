import type { DesktopAction } from '../../desktop/actions'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { PostEffectHandler } from './context'

const organizationActions = new Set<DesktopAction>([
  'thread.new',
  'thread.pin',
  'thread.rename',
  'thread.archive',
  'thread.archive-many',
  'thread.restore',
  'thread.restore-many',
  'thread.delete',
  'thread.delete-many',
  'composer.conversation.fork',
  'project.add',
  'project.edit-name',
  'project.remove-project',
  'project.archive-threads',
  'projects.import.apply',
  'workspace.create-worktree',
  'workspace.remove-worktree',
  'chat.group.create',
  'chat.group.rename',
  'chat.group.collapse',
  'chat.group.reorder',
  'chat.thread.move',
])

export const workspaceOrganizationPostEffect: PostEffectHandler = {
  matches: (ctx) => organizationActions.has(ctx.action),
  run: async (ctx) => {
    await ctx.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.chatSidebarState() })
  },
}
