export const transitionClass = "transition-colors duration-150 ease-out";

export const hoverSurfaceClass = "hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]";

export const panelChromeClass =
  "rounded-[20px] border border-[color:var(--border)] bg-[rgba(39,42,57,0.82)] shadow-[var(--shadow)] backdrop-blur-[18px]";

export const modalPanelClass =
  "border-[color:var(--border-strong)] bg-[rgba(34,37,50,0.96)] shadow-[0_24px_80px_rgba(0,0,0,0.34)]";

export const popoverPanelClass =
  "border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] shadow-[0_18px_40px_rgba(0,0,0,0.28)]";

export const confirmPopoverClass =
  "motion-popover absolute top-[calc(100%+6px)] right-0 z-20 flex items-center gap-1 rounded-xl p-1";

export const mainPanelClass =
  "min-h-0 overflow-y-scroll overflow-x-hidden pt-1.5 [scrollbar-gutter:stable_both-edges]";

export const viewShellClass = "mx-auto grid h-full w-full content-start gap-4 px-2 pt-6 pb-6";

export const viewTitleClass = "m-0 text-[18px] font-medium text-[color:var(--text)]";

export const viewSubtitleClass = "m-0 text-[13px] text-[color:var(--muted)]";

export const sectionIntroClass = "grid gap-1";

export const sectionTitleClass = "m-0 text-[15px] font-medium text-[color:var(--text)]";

export const sectionDescriptionClass = "m-0 text-[13px] text-[color:var(--muted)]";

export const disclosureButtonClass =
  "inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]";

export const emptyStateCardClass =
  "rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]";

export const segmentedControlClass =
  "inline-flex rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1";

export const segmentedControlOptionClass =
  "rounded-full px-3 py-1 text-[12px] capitalize transition-colors";

export const iconActionButtonDisabledClass =
  "disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40";

export const compactMetaRowActionsClass = "flex items-center gap-0.5";

export const iconButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent bg-transparent text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const compactIconButtonClass =
  "inline-flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]";

export const compactRoundIconButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-full px-0 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const toolbarButtonClass =
  "inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-transparent px-1.5 text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const ghostButtonClass =
  "rounded-[10px] border border-transparent px-2 py-1 text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const primaryButtonClass =
  "min-h-8 rounded-full bg-[color:var(--accent)] px-4 text-[13px] font-medium text-[#1a1c26] transition-opacity duration-150 ease-out hover:opacity-90";

export const interactiveCardClass =
  "rounded-[20px] border border-[color:var(--border)] bg-[rgba(39,42,57,0.9)] text-left shadow-[var(--shadow)] transition-colors duration-150 ease-out hover:bg-[rgba(44,47,64,0.94)]";

export const compactCardClass =
  "rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] text-left shadow-[var(--shadow)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.05)]";

export const featureCardClass = `${interactiveCardClass} grid min-h-[160px] gap-3.5 p-[18px]`;

export const sectionShellClass = "grid w-full max-w-[980px] content-start gap-[18px]";

export const menuItemClass =
  "flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left text-[14px]";

export const menuOptionClass =
  "grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] hover:bg-[rgba(255,255,255,0.04)]";

export const terminalOutputClass =
  "grid min-h-[92px] gap-2 rounded-[14px] border border-[rgba(137,146,183,0.08)] bg-[rgba(18,20,28,0.88)] p-2.5 font-mono text-xs";

export const diffPanelEmptyStateClass =
  "flex min-h-60 items-center justify-center px-5 text-center text-xs text-[color:var(--muted)]";

export const diffPanelTurnChipBaseClass =
  "shrink-0 rounded-lg border px-2 py-1 text-left transition-colors";

export const diffPanelTurnChipSelectedClass =
  "border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.06)] text-[color:var(--text)]";

export const diffPanelTurnChipUnselectedClass =
  "border-[color:var(--border)] bg-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]";

export const diffPanelIconButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const inlineCodeClass =
  "rounded-md bg-[rgba(114,120,152,0.18)] px-1.5 py-0.5 font-mono text-[11.5px] break-all text-[color:var(--text)]";

export const settingsSectionClass =
  "grid gap-3 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-3";

export const settingsSelectButtonClass =
  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]";

export const settingsInputClass =
  "min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]";

export const settingsListRowClass =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2";

export const settingsCompactListRowClass =
  "grid h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-2.5";
