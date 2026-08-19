import type { AppSettings, DesktopActionInvoker } from '../desktop/types'
import type { PiResourceInstallScope } from '../pi-resources/types'

export type SkillsViewProps = {
  appSettings: AppSettings
  projectPath: string | null
  onSetProjectScopeActive: (active: boolean) => void
  onProjectTargetSelected?: (() => void) | undefined
  onAction: DesktopActionInvoker
  onClose: () => void
}

export type InstallScope = PiResourceInstallScope
