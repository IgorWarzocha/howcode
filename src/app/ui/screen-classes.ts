import { appToneSubtleClass, appTypeTinyClass } from './classes'

export const skillsViewShellClass = 'view-shell--centered'

export const skillsListClass =
  'grid min-h-0 gap-0.5 overflow-y-scroll overflow-x-hidden pr-1 [scrollbar-gutter:stable]'

export const skillsPreviewListClass = `${skillsListClass} max-h-[14rem]`

export const skillsActionRailInsetClass = 'pr-[1.125rem]'

export const skillsActionColumnClass = 'inline-flex h-7 w-7 items-center justify-center'

export const skillsHeaderActionRailClass = skillsActionRailInsetClass

export const skillsSearchControlRowClass = `grid grid-cols-[minmax(0,1fr)_1.75rem] items-center gap-1 ${skillsActionRailInsetClass}`

export const skillsCreatorControlRowClass =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 pr-4'

export const skillsBrowsePreferenceButtonClass = `grid min-h-7 grid-cols-[auto_1.75rem] items-center gap-2 rounded-md py-0 pl-1.5 ${appTypeTinyClass} ${appToneSubtleClass} opacity-80 transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--muted)] hover:opacity-100`

export const skillsOpenFolderButtonClass = `inline-flex h-7 items-center gap-1 rounded-md px-1.5 py-0 ${appTypeTinyClass} ${appToneSubtleClass} opacity-80 transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[color:var(--muted)]`
