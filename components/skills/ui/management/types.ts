import type { AppSettings, DesktopActionInvoker } from '../../../../src/app/desktop/types'
import type { PiResourceInstallScope } from '../../../../src/app/pi-resources/types'

export type SkillsViewProps = {
  appSettings: AppSettings
  directoryPath: string | null
  onSetDirectoryScopeActive: (active: boolean) => void
  onDirectoryTargetSelected?: (() => void) | undefined
  onAction: DesktopActionInvoker
  onClose: () => void
}

export type InstallScope = PiResourceInstallScope
