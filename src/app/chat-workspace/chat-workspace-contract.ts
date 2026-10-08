import type { AppShellController } from '../app-shell/useAppShellController'

export type ChatWorkspaceController = Pick<
  AppShellController,
  'workspaces' | 'composer' | 'desktop' | 'navigation' | 'terminal' | 'chat' | 'workspace'
>
