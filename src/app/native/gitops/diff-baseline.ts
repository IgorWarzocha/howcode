import type {
  ProjectCommitEntry,
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
} from '../../desktop/types'

export const defaultDiffBaseline = { kind: 'main-branch' } as const satisfies ProjectDiffBaseline

export function getDiffBaselinePrefix(baseline: ProjectDiffBaseline | null | undefined) {
  return baseline?.kind === 'main-branch' ||
    baseline?.kind === 'dev-branch' ||
    baseline?.kind === 'branch'
    ? 'from'
    : 'since'
}

export function getDiffBaselineLabel(
  baseline: ProjectDiffBaseline | null | undefined,
  commits: ProjectCommitEntry[] = [],
) {
  if (baseline?.kind === 'previous') {
    return 'prev commit'
  }

  if (baseline?.kind === 'main-branch') {
    return 'default branch'
  }

  if (baseline?.kind === 'dev-branch') {
    return 'dev branch'
  }

  if (baseline?.kind === 'parent-branch') {
    return `parent · ${baseline.branchName}`
  }

  if (baseline?.kind === 'branch') {
    return baseline.branchName
  }

  if (baseline?.kind === 'last-opened') {
    return 'last opened'
  }

  if (baseline?.kind === 'commit') {
    const selectedCommit = commits.find((commit) => commit.sha === baseline.sha)
    return selectedCommit?.shortSha || baseline.sha.slice(0, 7) || 'selected commit'
  }

  return 'last commit'
}

export function getResolvedDiffBaselineLabel(
  baseline: ProjectDiffBaseline | null | undefined,
  resolvedBaseline: ProjectDiffResolvedBaseline | null | undefined,
) {
  switch (baseline?.kind ?? 'head') {
    case 'previous':
      return 'prev commit'
    case 'main-branch':
      return resolvedBaseline?.label || 'default branch'
    case 'dev-branch':
      return 'dev branch'
    case 'parent-branch':
      return resolvedBaseline?.label || 'parent branch'
    case 'branch':
      return resolvedBaseline?.label || 'branch'
    case 'last-opened':
      return 'last opened'
    case 'commit':
      return resolvedBaseline?.shortSha || resolvedBaseline?.commitSha?.slice(0, 7) || 'that commit'
    default:
      return 'last commit'
  }
}
