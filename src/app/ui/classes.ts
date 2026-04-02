export const transitionClass = "transition-colors duration-150 ease-out";

export const hoverSurfaceClass = "hover:bg-[var(--surface-hover)] hover:text-[color:var(--text)]";

export const panelChromeClass =
  "rounded-[20px] border border-[color:var(--border)] bg-[rgba(39,42,57,0.82)] shadow-[var(--shadow)] backdrop-blur-[18px]";

export const mainPanelClass =
  "min-h-0 overflow-y-scroll overflow-x-hidden pt-1.5 [scrollbar-gutter:stable_both-edges]";

export const iconButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-transparent bg-transparent text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const navButtonClass =
  "flex min-h-8 w-full items-center gap-2 rounded-[10px] border border-transparent px-2.5 text-[13px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const toolbarButtonClass =
  "inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-transparent px-1.5 text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const ghostButtonClass =
  "rounded-[10px] border border-transparent px-2 py-1 text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";

export const primaryButtonClass =
  "min-h-8 rounded-full bg-[color:var(--accent)] px-4 text-[13px] font-medium text-[#1a1c26] transition-opacity duration-150 ease-out hover:opacity-90";

export const interactiveCardClass =
  "rounded-[20px] border border-[color:var(--border)] bg-[rgba(39,42,57,0.9)] text-left shadow-[var(--shadow)] transition-colors duration-150 ease-out hover:bg-[rgba(44,47,64,0.94)]";

export const featureCardClass = `${interactiveCardClass} grid min-h-[160px] gap-3.5 p-[18px]`;

export const sectionShellClass = "grid w-full max-w-[980px] content-start gap-[18px]";

export const sidebarSectionLabelClass =
  "flex items-center justify-between px-1.5 pt-1.5 text-[12px] leading-5 text-[color:var(--muted)]";

export const terminalOutputClass =
  "grid min-h-[92px] gap-2 rounded-[14px] border border-[rgba(137,146,183,0.08)] bg-[rgba(18,20,28,0.88)] p-2.5 font-mono text-xs";

export const inlineCodeClass =
  "rounded-md bg-[rgba(114,120,152,0.18)] px-1.5 py-0.5 font-mono text-[11.5px] break-all text-[color:var(--text)]";
