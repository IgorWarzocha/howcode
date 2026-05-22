import {
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeCodeClass,
  appTypeControlClass,
  appTypeGroupTextClass,
  appTypeGroupTitleClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  appTypeTinyClass,
  appTypeViewTitleClass,
} from './typography-scale'

export {
  appToneAccentClass,
  appToneDangerClass,
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeCodeBlockClass,
  appTypeCodeClass,
  appTypeControlClass,
  appTypeControlNormalClass,
  appTypeControlStrongClass,
  appTypeDashboardLabelClass,
  appTypeDashboardLabelStrongClass,
  appTypeDashboardMetricClass,
  appTypeDashboardTitleClass,
  appTypeGroupTextClass,
  appTypeGroupTitleClass,
  appTypeHeroTitleClass,
  appTypeKickerClass,
  appTypeLogoMarkClass,
  appTypeMetaClass,
  appTypeMetaStrongClass,
  appTypeReadableClass,
  appTypeReadableStrongClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  appTypeSmallStrongClass,
  appTypeTinyClass,
  appTypeTinyStrongClass,
  appTypeViewTitleClass,
} from './typography-scale'

export const transitionClass = 'transition-colors duration-150 ease-out'

export const hoverSurfaceClass = 'hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]'

export const panelChromeClass =
  'rounded-[20px] border border-[color:var(--border)] bg-[color:var(--panel)] shadow-[var(--shadow)] backdrop-blur-[18px]'

export const modalPanelClass =
  'border-[color:var(--border-strong)] bg-[color:var(--panel)] shadow-[var(--shadow)]'

export const popoverPanelClass =
  'border-[color:var(--border-strong)] bg-[color:var(--panel)] shadow-[var(--shadow)]'

export const confirmPopoverClass =
  'motion-popover absolute top-[calc(100%+6px)] right-0 z-20 flex items-center gap-1 rounded-xl p-1'

export const mainPanelClass =
  'min-h-0 overflow-y-scroll overflow-x-hidden pt-1.5 [scrollbar-gutter:stable_both-edges]'

export const viewShellClass = 'mx-auto grid h-full w-full content-start gap-4 px-2 pt-6 pb-6'

export const viewTitleClass = `m-0 ${appTypeViewTitleClass} ${appToneTextClass}`

export const viewSubtitleClass = `m-0 ${appTypeGroupTextClass} ${appToneMutedClass}`

export const sectionIntroClass = 'grid gap-1'

export const sectionTitleClass = `m-0 ${appTypeSectionTitleClass} ${appToneTextClass}`

export const sectionDescriptionClass = `m-0 ${appTypeGroupTextClass} ${appToneMutedClass}`

export const sectionHeadingClass = `inline-flex items-center gap-1.5 text-left ${appTypeSectionTitleClass} ${appToneTextClass}`

export const disclosureButtonClass = sectionHeadingClass

export const emptyStateCardClass = `rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 ${appTypeSmallClass} ${appToneMutedClass}`

export const processLedgerClass =
  'grid min-w-0 max-w-full gap-1 border-l border-[color:var(--border)]/70 pl-3'

export const processLedgerRowClass =
  'min-h-8 min-w-0 max-w-full rounded-lg bg-transparent px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--accent-border)]'

export const foldedTimelineRowClass = `${processLedgerRowClass} folded-timeline-row`

export const foldedUserTimelineRowClass = `${processLedgerRowClass} folded-timeline-row--user`

export const processLedgerRowExpandedClass =
  'mt-1 ml-2 grid min-w-0 max-w-[calc(100%-0.5rem)] gap-2 border-l border-[color:var(--border)]/70 py-1.5 pl-3'

export const processLedgerDetailBlockClass = `grid min-w-0 max-w-full gap-1 overflow-hidden border-l border-[color:var(--border)]/70 bg-[color:var(--folded-row-bg)] px-2 py-1.5 ${appTypeCodeClass} text-[color:var(--muted-2)]/82`

export const threadSessionSurfaceClass = 'thread-session-surface'

export const threadSessionControlClass = 'thread-session-control'

export const threadUserMessageClass = `thread-user-message ${threadSessionSurfaceClass}`

export const threadSessionStripClass = `grid min-w-0 gap-2 bg-[color:var(--folded-row-bg)] px-3 py-2.5 ${appTypeGroupTextClass} ${threadSessionSurfaceClass}`

export const threadSessionErrorStripClass = `grid min-w-0 gap-2 bg-[color:color-mix(in_srgb,var(--danger-bg)_50%,transparent)] px-3 py-2.5 text-[color:var(--danger)] ${threadSessionSurfaceClass}`

export const thinkingDisclosureClass = `overflow-visible bg-[color:var(--folded-row-bg)] ${threadSessionSurfaceClass}`

export const thinkingDisclosureTriggerClass = `px-2.5 py-2 hover:bg-[color:var(--folded-row-hover-bg)] ${threadSessionSurfaceClass}`

export const thinkingDisclosureBodyClass =
  '!border-0 border-l border-[color:var(--border)]/70 px-3 py-2.5'

export const artifactStripClass = 'rounded-lg bg-[color:var(--folded-row-bg)] px-3 py-2 text-left'

export const changedFilesStripClass = `flex min-w-0 items-center gap-2 rounded-lg bg-[color:var(--folded-row-bg)] px-3 py-2 ${appTypeSmallClass} ${appToneMutedClass}`

export const quietListFrameClass = 'grid min-w-0 divide-y divide-[color:var(--border)]/70'

export const quietListRowClass =
  'grid min-w-0 gap-1 px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)]'

export const quietListScrollClass =
  'grid min-h-0 gap-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]'

export const quietCheckboxClass =
  'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-[color:var(--border)] bg-transparent text-[color:var(--muted)] transition-colors'

export const quietCheckboxCheckedClass =
  'border-[color:var(--border-strong)] bg-[color:var(--surface-hover)] text-[color:var(--muted)]'

const quietMetaRowBaseClass =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center bg-transparent text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)]'

export const quietMetaRowClass = `${quietMetaRowBaseClass} min-h-8 gap-1.5 rounded-lg px-2 py-1.5`

export const quietMetaRowDenseClass = `${quietMetaRowBaseClass} min-h-7 gap-1 rounded-md px-1.5 py-0.5`

export const quietMetaRowSelectedClass = 'bg-[color:var(--folded-row-bg)]'

export const quietSearchInputClass =
  'settings-control-text min-w-0 flex-1 rounded-lg border-0 bg-[color:var(--surface-hover)] px-3 py-2 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]'

export const inlineEmptyNoteClass = `px-2 py-1.5 ${appTypeSmallClass} ${appToneSubtleClass}`

export const segmentedControlClass =
  'inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] p-1'

export const segmentedControlOptionClass = `rounded-full px-3 py-1 ${appTypeSmallClass} capitalize transition-colors`

export const iconActionButtonDisabledClass =
  'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40'

export const compactMetaRowActionsClass = 'flex items-center gap-0.5'

export const iconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent bg-transparent text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'

export const compactIconButtonClass =
  'inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'

export const compactRoundIconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-full px-0 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'

export const viewCloseButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] opacity-75 transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100'

export const toolbarButtonClass = `inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-transparent px-1.5 ${appTypeControlClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`

export const ghostButtonClass = `rounded-[10px] border border-transparent px-2 py-1 ${appTypeControlClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`

export const primaryButtonClass = `min-h-8 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] px-4 ${appTypeGroupTitleClass} ${appToneTextClass} transition-colors duration-150 ease-out hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-bg-strong)] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[color:var(--panel)] disabled:text-[color:var(--muted-2)]`

export const composerTextActionButtonClass = `settings-control-text inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--panel-2)] px-3 font-medium ${appToneTextClass} transition-colors duration-150 ease-out hover:border-[color:var(--accent-border)] hover:bg-[color:var(--accent-bg-subtle)] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[color:var(--panel)] disabled:text-[color:var(--muted-2)]`

export const composerPanelClass =
  'grid gap-0 overflow-visible rounded-[20px] border border-[color:color-mix(in_srgb,var(--accent-border)_52%,transparent)] bg-[color:var(--panel)] shadow-none'

export const composerDividerClass = 'h-px bg-[color:var(--border)]'

export const composerPopoverInputClass = `settings-control-text h-8 min-w-0 rounded-md border-0 bg-[color:var(--surface-hover)] px-2.5 ${appTypeControlClass} ${appToneTextClass} outline-none placeholder:text-[color:var(--muted)] focus:bg-[color:var(--surface-hover)]`

export const composerPopoverPanelClass =
  'pointer-events-auto scroll-py-1.5 rounded-xl border-0 bg-[color:var(--panel)] p-1.5 shadow-[var(--shadow)]'

export const composerPopoverOptionClass = `grid w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-md px-2.5 text-left ${appTypeControlClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:outline-none`

export const composerPopoverOptionSelectedClass =
  'bg-[color:var(--surface-hover)] text-[color:var(--text)]'

export const composerPopoverSectionLabelClass = `px-2 pt-1 ${appTypeTinyClass} uppercase tracking-[0.08em] ${appToneMutedClass}`

export const interactiveCardClass =
  'rounded-[20px] border border-[color:var(--border)] bg-[color:var(--panel)] text-left shadow-[var(--shadow)] transition-colors duration-150 ease-out hover:bg-[color:var(--panel-2)]'

export const compactCardClass =
  'rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] text-left shadow-[var(--shadow)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)]'

export const featureCardClass = `${interactiveCardClass} grid min-h-[160px] gap-3.5 p-[18px]`

export const sectionShellClass = 'grid w-full max-w-[980px] content-start gap-[18px]'

export const menuItemClass = `flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left ${appTypeBodyClass}`

export const menuOptionClass = `grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${appTypeGroupTextClass} hover:bg-[color:var(--surface-hover)]`

export const terminalOutputClass =
  'grid min-h-[92px] gap-2 rounded-[14px] border border-[rgba(137,146,183,0.08)] bg-[rgba(18,20,28,0.88)] p-2.5 font-mono text-xs'

export const terminalTakeoverFooterClass =
  'relative z-[80] overflow-visible rounded-b-[20px] bg-[color:var(--panel)] shadow-none'

export const terminalDrawerFooterClass =
  'flex h-[3.75rem] shrink-0 items-start justify-end gap-3 bg-[color:var(--workspace)] px-3 pt-1.5'

export const diffPanelEmptyStateClass = `flex min-h-60 items-center justify-center px-5 text-center ${appTypeSmallClass} ${appToneMutedClass}`

export const diffPanelTurnChipBaseClass =
  'shrink-0 rounded-lg border px-2 py-1 text-left transition-colors'

export const diffPanelTurnChipSelectedClass =
  'border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]'

export const diffPanelTurnChipUnselectedClass =
  'border-[color:var(--border)] bg-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]'

export const diffPanelIconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]'

export const inlineCodeClass = `rounded-md bg-[rgba(114,120,152,0.18)] px-1.5 py-0.5 ${appTypeCodeClass} break-all ${appToneTextClass}`

export const settingsSectionClass =
  'grid gap-3 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-3'

export const settingsSelectButtonClass =
  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]'

export const settingsInputClass =
  'settings-control-text min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]'

export const settingsListRowClass =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2'

export const settingsCompactListRowClass =
  'grid h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2.5'
