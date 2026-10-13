export { iconButtonClass, quietEmptyStateClass } from '@howaboua/howcode-sdk/ui/classes'

import {
  appToneMutedClass,
  appToneTextClass,
  appTypeCodeClass,
  appTypeControlClass,
  appTypeGroupTextClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'

export const chatSessionStripClass = `grid min-w-0 gap-2 rounded-lg bg-[color:var(--folded-row-bg)] px-3 py-2.5 ${appTypeGroupTextClass}`

export const mainPanelClass =
  'min-h-0 overflow-y-scroll overflow-x-hidden pt-1.5 [scrollbar-gutter:stable_both-edges]'

export const quietListFrameClass = 'grid min-w-0 divide-y divide-[color:var(--border)]/70'

export const quietListRowClass =
  'grid min-w-0 gap-1 px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)]'

export const ghostButtonClass = `rounded-[10px] border border-transparent px-2 py-1 ${appTypeControlClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`

export const inlineCodeClass = `rounded-md bg-[rgba(114,120,152,0.18)] px-1.5 py-0.5 ${appTypeCodeClass} break-all ${appToneTextClass}`
