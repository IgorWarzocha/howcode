export type PiResourceInstallScope = 'global' | 'project' | 'chat'

export type PiResourcePendingAction = {
  kind: 'install' | 'remove'
  source: string
}
