export type PiResourceInstallScope = 'global' | 'directory' | 'chat'

export type PiResourcePendingAction = {
  kind: 'install' | 'remove'
  source: string
}
