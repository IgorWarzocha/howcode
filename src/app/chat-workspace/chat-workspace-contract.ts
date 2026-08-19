import type { AppShellController } from '../app-shell/useAppShellController'

export type ChatWorkspaceController = Pick<
  AppShellController,
  'chat' | 'composer' | 'desktop' | 'navigation' | 'takeover' | 'terminal' | 'thread' | 'workspace'
>
