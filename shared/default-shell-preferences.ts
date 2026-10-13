import type { ShellPreferences } from './desktop-settings-contracts'

export const defaultShellPreferences: ShellPreferences = {
  theme: 'howcode-default',
  autoCompact: true,
  blockImages: false,
  transport: 'auto',
  steeringMode: 'one-at-a-time',
  followUpMode: 'one-at-a-time',
}
