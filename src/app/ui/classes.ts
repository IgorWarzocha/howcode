import {
  appToneDangerClass,
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeCodeClass,
  appTypeControlClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeReadableClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  appTypeViewTitleClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'

export const mainPanelClass =
  'min-h-0 overflow-y-scroll overflow-x-hidden pt-1.5 [scrollbar-gutter:stable_both-edges]'

export const viewShellClass = 'mx-auto grid h-full w-full content-start gap-4 px-2 pt-6 pb-6'

export const viewTitleClass = `m-0 ${appTypeViewTitleClass} ${appToneTextClass}`

export const viewSubtitleClass = `m-0 ${appTypeGroupTextClass} ${appToneMutedClass}`

export const sectionHeadingClass = `inline-flex items-center gap-1.5 text-left ${appTypeSectionTitleClass} ${appToneTextClass}`

export const disclosureButtonClass = sectionHeadingClass

export const processLedgerClass =
  'grid min-w-0 max-w-full gap-1 border-l border-[color:var(--border)]/70 pl-3'

export const processLedgerRowClass =
  'min-h-8 min-w-0 max-w-full rounded-lg bg-transparent px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--accent-border)]'

export const foldedTimelineRowClass = `${processLedgerRowClass} folded-timeline-row`

export const foldedUserTimelineRowClass = `${processLedgerRowClass} folded-timeline-row--user`

export const processLedgerRowExpandedClass =
  'mt-1 ml-2 grid min-w-0 max-w-[calc(100%_-_0.5rem)] gap-2 border-l border-[color:var(--border)]/70 py-1.5 pl-3'

export const processLedgerDetailBlockClass = `grid min-w-0 max-w-full gap-1 overflow-hidden border-l border-[color:var(--border)]/70 bg-[color:var(--folded-row-bg)] px-2 py-1.5 ${appTypeCodeClass} text-[color:var(--muted-2)]/82`

export const chatSessionSurfaceClass = 'thread-session-surface'

export const chatUserMessageClass = `thread-user-message ${chatSessionSurfaceClass}`

export const chatSessionStripClass = `grid min-w-0 gap-2 bg-[color:var(--folded-row-bg)] px-3 py-2.5 ${appTypeGroupTextClass} ${chatSessionSurfaceClass}`

export const chatSessionErrorStripClass = `grid min-w-0 gap-2 bg-[color:color-mix(in_srgb,var(--danger-bg)_50%,transparent)] px-3 py-2.5 text-[color:var(--danger)] ${chatSessionSurfaceClass}`

export const thinkingDisclosureClass = `overflow-visible bg-[color:var(--folded-row-bg)] ${chatSessionSurfaceClass}`

export const thinkingDisclosureTriggerClass = `px-2.5 py-2 hover:bg-[color:var(--folded-row-hover-bg)] ${chatSessionSurfaceClass}`

export const thinkingDisclosureBodyClass =
  '!border-0 border-l border-[color:var(--border)]/70 px-3 py-2.5'

export const artifactHeaderClass =
  'flex min-h-10 items-center justify-between gap-2 bg-[color:var(--workspace)] px-2 py-1.5 shadow-[inset_0_-1px_color-mix(in_srgb,var(--border)_58%,transparent)] min-[420px]:gap-3 min-[420px]:px-3'

export const artifactHeaderTitleClass = `flex min-w-0 flex-1 items-center gap-2 ${appTypeGroupTextClass} ${appToneTextClass}`

export const artifactHeaderControlsClass =
  'flex min-w-0 shrink items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export const artifactHeaderControlActiveClass =
  'bg-[color:var(--surface-hover)] text-[color:var(--text)]'

export const artifactVersionTriggerClass = `artifact-version-trigger inline-flex h-7 max-w-28 shrink-0 items-center gap-1 rounded-md bg-[color:var(--surface-hover)] px-2 ${appTypeControlClass} ${appToneMutedClass} outline-none transition-colors hover:text-[color:var(--text)]`

export const artifactBodyClass =
  'relative min-h-0 flex-1 overflow-hidden bg-[color:var(--workspace)]'

export const artifactCenteredStateClass = `grid h-full place-items-center px-6 text-center ${appTypeSmallClass}`

export const artifactListClass =
  'h-full overflow-y-auto overflow-x-hidden px-2 py-1.5 [scrollbar-gutter:stable]'

export const artifactListRowClass = `grid w-full min-w-0 gap-0.5 rounded-md px-2 py-1.5 text-left ${appTypeSmallClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`

export const artifactCodeEditorClass = `h-full w-full resize-none overflow-auto bg-transparent px-3 py-2.5 ${appTypeCodeClass} ${appToneTextClass} outline-none placeholder:text-[color:var(--muted)]`

export const artifactPreviewSurfaceClass =
  'relative h-full overflow-hidden bg-[color:var(--workspace)]'

export const artifactErrorStripClass = `absolute right-2 bottom-2 left-2 z-10 max-h-32 overflow-auto rounded-md bg-[color:color-mix(in_srgb,var(--danger-bg)_55%,var(--workspace))] px-2.5 py-2 ${appTypeMetaClass} whitespace-pre-wrap ${appToneDangerClass} shadow-[0_14px_32px_rgba(0,0,0,0.24)]`

export const artifactMarkdownPreviewClass = `h-full min-h-0 overflow-auto bg-[color:var(--workspace)] px-7 py-6 ${appTypeReadableClass} ${appToneTextClass} [text-wrap:pretty] [&_h1]:[text-wrap:balance] [&_h2]:[text-wrap:balance] [&_h3]:[text-wrap:balance] [&_pre]:[text-wrap:initial]`

export const quietListFrameClass = 'grid min-w-0 divide-y divide-[color:var(--border)]/70'

export const quietListRowClass =
  'grid min-w-0 gap-1 px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)]'

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

export const quietEmptyStateClass = `rounded-lg bg-[color:var(--folded-row-bg)] px-3 py-2.5 ${appTypeSmallClass} ${appToneMutedClass}`

export const iconActionButtonDisabledClass =
  'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40'

export const compactMetaRowActionsClass = 'flex items-center gap-0.5'

export const iconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent bg-transparent text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'

export const compactRoundIconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-full px-0 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'

export const viewCloseButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] opacity-75 transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100'

export const ghostButtonClass = `rounded-[10px] border border-transparent px-2 py-1 ${appTypeControlClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`

export const composerInlineStatusPillClass = `inline-flex h-6 max-w-[min(10.75rem,45cqw)] shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--surface-hover)] px-2.5 ${appTypeSmallClass} ${appToneMutedClass}`

export const composerPopoverContextLayerClass = 'z-[180]'

export const settingsPopoverPanelClass =
  'pointer-events-auto scroll-py-1.5 rounded-xl border-0 bg-[color:var(--panel)] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]'

export const composerAttachmentPickerTextClass = appTypeMetaClass

export const composerOverlayPanelInsetClass = 'px-4'

export const menuOptionClass = `grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${appTypeGroupTextClass} hover:bg-[color:var(--surface-hover)]`

export const terminalDrawerFooterClass =
  'flex h-[3.75rem] shrink-0 items-start justify-end gap-3 bg-[color:var(--workspace)] px-3 pt-1.5'

export const inlineCodeClass = `rounded-md bg-[rgba(114,120,152,0.18)] px-1.5 py-0.5 ${appTypeCodeClass} break-all ${appToneTextClass}`

export const settingsInputClass =
  'settings-control-text min-w-0 flex-1 rounded-lg border-0 bg-[color:var(--surface-hover)] px-3 py-2 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)] focus:bg-[color:var(--folded-row-hover-bg)]'
