export type GitOpsVisualMode = 'dirty' | 'clean' | 'not-git'

const gitCountFormatter = new Intl.NumberFormat()

export function formatGitCount(value: number) {
  return gitCountFormatter.format(value)
}

export function getGitOpsEntryButtonClass(mode: GitOpsVisualMode) {
  if (mode === 'not-git') {
    return 'text-[color:var(--danger)]/85 hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]'
  }

  if (mode === 'dirty') {
    return 'text-[color:color-mix(in_srgb,var(--green)_82%,var(--muted))] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--green)]'
  }

  return 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'
}
