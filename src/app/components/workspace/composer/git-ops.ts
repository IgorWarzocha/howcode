export type GitOpsVisualMode = 'dirty' | 'clean' | 'not-git'

export function formatGitCount(value: number) {
  return new Intl.NumberFormat().format(value)
}

export function getGitOpsEntryButtonClass(mode: GitOpsVisualMode) {
  if (mode === 'not-git') {
    return 'border-[color:var(--danger-border)] text-[color:var(--danger)] hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]'
  }

  if (mode === 'dirty') {
    return 'border-[color:var(--accent-border)] text-[color:var(--green)] hover:border-[color:var(--accent-border)] hover:bg-[color:var(--accent-bg-subtle)] hover:text-[color:var(--text)]'
  }

  return 'border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'
}
