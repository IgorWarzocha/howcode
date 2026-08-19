import type { PiResourceInstallScope } from '../pi-resources/types'

export type ExtensionsViewProps = {
  projectPath: string | null
  onSetProjectScopeActive: (active: boolean) => void
  onProjectTargetSelected?: (() => void) | undefined
  onClose: () => void
}

export type InstallScope = PiResourceInstallScope

export type ManualSourceKind = 'npm' | 'git'
