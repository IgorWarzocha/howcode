import type { DesktopAction } from '../../desktop/actions'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { PostEffectHandler } from './context'

const organizationActions = new Set<DesktopAction>([
  'chat.new',
  'chat.pin',
  'chat.rename',
  'chat.archive',
  'chat.archive-many',
  'chat.restore',
  'chat.restore-many',
  'chat.delete',
  'chat.delete-many',
  'composer.conversation.fork',
  'directory.add',
  'directory.edit-name',
  'directory.remove',
  'directory.archive-chats',
  'directories.import.apply',
  'coding.create-worktree',
  'coding.remove-worktree',
  'workspace.create',
  'workspace.rename',
  'workspace.collapse',
  'workspace.reorder',
  'chat.move',
])

export const workspaceOrganizationPostEffect: PostEffectHandler = {
  matches: (ctx) => organizationActions.has(ctx.action),
  run: async (ctx) => {
    await ctx.queryClient.invalidateQueries({
      queryKey: desktopQueryKeys.workspaceNavigationState(),
    })
  },
}
