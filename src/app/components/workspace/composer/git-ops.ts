export type GitOpsVisualMode = "dirty" | "clean" | "not-git";

export function formatGitCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function getGitOpsEntryButtonClass(mode: GitOpsVisualMode) {
  if (mode === "not-git") {
    return "border-[color:var(--danger-border)] text-[color:var(--danger)] hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]";
  }

  if (mode === "dirty") {
    return "border-[rgba(92,201,165,0.22)] text-[#7ee0bb] hover:border-[rgba(92,201,165,0.34)] hover:bg-[rgba(92,201,165,0.08)] hover:text-[#bdf7dd]";
  }

  return "border-[rgba(169,178,215,0.16)] text-[color:var(--muted)] hover:border-[rgba(169,178,215,0.26)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]";
}
