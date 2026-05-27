import type { AppSettings, DesktopActionInvoker } from '../desktop/types'

export type SkillsViewProps = {
  appSettings: AppSettings
  projectPath: string | null
  onSetProjectScopeActive: (active: boolean) => void
  onProjectTargetSelected?: (() => void) | undefined
  onAction: DesktopActionInvoker
  onClose: () => void
}

export type InstallScope = 'global' | 'project' | 'chat'

export type PendingAction = {
  kind: 'install' | 'remove'
  source: string
}
