import {
  appToneDangerClass,
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeCodeClass,
  appTypeControlClass,
  appTypeGroupTextClass,
  appTypeGroupTitleClass,
  appTypeMetaClass,
  appTypeReadableClass,
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
  appTypeCompactWidgetClass,
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
  'motion-popover pointer-events-auto absolute top-[calc(100%+0.25rem)] right-0 z-50 flex gap-0.5 rounded-lg border-0 bg-[color:var(--panel)] p-1 shadow-[var(--shadow)]'

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

export const processLedgerClass =
  'grid min-w-0 max-w-full gap-1 border-l border-[color:var(--border)]/70 pl-3'

export const processLedgerRowClass =
  'min-h-8 min-w-0 max-w-full rounded-lg bg-transparent px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--accent-border)]'

export const foldedTimelineRowClass = `${processLedgerRowClass} folded-timeline-row`

export const foldedUserTimelineRowClass = `${processLedgerRowClass} folded-timeline-row--user`

export const processLedgerRowExpandedClass =
  'mt-1 ml-2 grid min-w-0 max-w-[calc(100%_-_0.5rem)] gap-2 border-l border-[color:var(--border)]/70 py-1.5 pl-3'

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

export const quietEmptyStateClass = `rounded-lg bg-[color:var(--folded-row-bg)] px-3 py-2.5 ${appTypeSmallClass} ${appToneMutedClass}`

export const segmentedControlClass =
  'inline-flex rounded-lg bg-[color:var(--surface-hover)] p-[3px]'

export const segmentedControlOptionClass = `rounded-md px-2.5 py-1 ${appTypeSmallClass} capitalize transition-colors`

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

export const composerInlineStatusPillClass = `inline-flex h-6 max-w-[min(10.75rem,45cqw)] shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--surface-hover)] px-2.5 ${appTypeSmallClass} ${appToneMutedClass}`

export const composerInlineConfirmButtonClass =
  'composer-footer-text motion-popover pointer-events-auto absolute right-[calc(1.75rem+0.375rem)] bottom-0 z-40 inline-flex h-7 items-center rounded-lg border-0 bg-[color:var(--panel)] px-2 text-left whitespace-nowrap text-[color:var(--muted)] shadow-none transition-colors hover:bg-[color:var(--panel-2)] focus-visible:bg-[color:var(--panel-2)] focus-visible:outline-none'

export const composerPopoverInputClass = `settings-control-text h-8 min-w-0 rounded-md border-0 bg-[color:var(--surface-hover)] px-2.5 ${appTypeControlClass} ${appToneTextClass} outline-none placeholder:text-[color:var(--muted)] focus:bg-[color:var(--surface-hover)]`

// Composer-local overlay ladder. Context popover should win because it can overlap extension UI.
export const composerPopoverContextLayerClass = 'z-[180]'

export const composerPopoverBottomRowLayerClass = 'z-[140]'

export const composerPopoverInputLayerClass = 'z-[120]'

export const composerPopoverExtensionLayerClass = 'z-[100]'

export const piExtensionMonoClass = 'pi-extension-mono'

export const piExtensionTextClass = piExtensionMonoClass

export const composerPopoverPanelClass =
  'pointer-events-auto scroll-py-1.5 rounded-xl border-0 bg-[color:var(--panel)] p-1.5 shadow-[var(--shadow)]'

export const settingsPopoverPanelClass =
  'pointer-events-auto scroll-py-1.5 rounded-xl border-0 bg-[color:var(--panel)] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.34)]'

export const composerPopoverOptionClass = `grid w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-md px-2.5 text-left ${appTypeControlClass} ${appToneMutedClass} transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:outline-none`

export const composerPopoverOptionSelectedClass =
  'bg-[color:var(--surface-hover)] text-[color:var(--text)]'

export const composerPopoverSectionLabelClass = `px-2 pt-1 ${appTypeTinyClass} uppercase tracking-[0.08em] ${appToneMutedClass}`

export const composerAttachmentPickerTextClass = appTypeMetaClass

export const composerOverlayPanelInsetClass = 'px-4'

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

export const diffPanelMainSurfaceClass =
  'flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--workspace)]'

export const diffPanelSplitSurfaceClass = `${diffPanelMainSurfaceClass} rounded-[20px] border-l border-[color:var(--border)]/70 xl:w-full`

export const diffRailClass =
  'flex h-full min-h-0 w-full flex-col bg-[color:var(--workspace)] text-[color:var(--text)]'

export const diffRailHeaderClass =
  'flex h-9 shrink-0 items-center gap-2 px-2.5 text-[color:var(--muted)]'

export const diffRailSearchClass = `flex min-h-8 shrink-0 items-center gap-2 rounded-lg bg-[color:var(--surface-hover)] px-2.5 transition-colors focus-within:bg-[color:var(--folded-row-hover-bg)] ${appTypeGroupTextClass} ${appToneMutedClass}`

export const diffRailTreeWrapperClass =
  'flex min-h-0 flex-1 flex-col gap-2 bg-[color:var(--workspace)] px-2.5 pt-1.5 pb-0'

export const diffFileHeaderButtonClass =
  'flex min-h-9 w-full items-center justify-between gap-3 bg-transparent px-3 py-1.5 text-left text-[color:var(--text)] transition-colors hover:bg-[color:var(--surface-hover)]'

export const diffFileShellClass =
  'overflow-hidden rounded-md border border-[color:var(--border)]/55 bg-[color:var(--workspace)]'

export const diffCommentGutterButtonClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-md bg-[color:var(--accent-bg)] text-[color:var(--text)] transition hover:bg-[color:var(--accent-bg-strong)]'

export const diffCommentAnnotationClass = 'ml-3 mr-0 mb-1.5 grid gap-1.5 py-1 pl-2.5 pr-0'

export const diffCommentTextareaClass = `min-h-12 w-full resize-y rounded-md border border-[color:var(--border)]/70 bg-transparent px-2 py-1.5 outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--border-strong)] focus:bg-[color:var(--surface-hover)] ${appTypeSmallClass} ${appToneTextClass}`

export const diffCommentSaveButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--green)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40'

export const diffImagePreviewClass =
  'grid gap-3 border-t border-[color:var(--border)]/55 bg-[color:var(--workspace)] p-3 md:grid-cols-2'

export const diffImagePreviewPanelClass =
  'grid min-w-0 gap-2 rounded-md bg-[color:var(--folded-row-bg)] p-2'

export const diffImagePreviewFrameClass =
  'flex min-h-40 items-center justify-center overflow-hidden rounded-md bg-[color:var(--workspace)]'

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
  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-0 bg-[color:var(--surface-hover)] px-3 py-2 text-left transition-colors hover:bg-[color:var(--folded-row-hover-bg)]'

export const settingsInputClass =
  'settings-control-text min-w-0 flex-1 rounded-lg border-0 bg-[color:var(--surface-hover)] px-3 py-2 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)] focus:bg-[color:var(--folded-row-hover-bg)]'

export const settingsListRowClass =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-transparent px-2 py-1.5 transition-colors hover:bg-[color:var(--surface-hover)]'

export const settingsCompactListRowClass =
  'grid h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-md bg-transparent px-2 transition-colors hover:bg-[color:var(--surface-hover)]'
