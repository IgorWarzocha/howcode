import type { PiSettings } from './desktop-settings-contracts'

export const defaultPiSettings: PiSettings = {
  theme: 'howcode-default',
  autoCompact: true,
  enableSkillCommands: true,
  hideThinkingBlock: false,
  quietStartup: false,
  showImages: true,
  autoResizeImages: true,
  blockImages: false,
  collapseChangelog: false,
  enableInstallTelemetry: true,
  showHardwareCursor: false,
  clearOnShrink: false,
  transport: 'auto',
  steeringMode: 'one-at-a-time',
  followUpMode: 'one-at-a-time',
  doubleEscapeAction: 'tree',
  treeFilterMode: 'default',
  editorPaddingX: 0,
  autocompleteMaxVisible: 5,
  imageWidthCells: 60,
}
