import { createHash } from 'node:crypto'
import type {
  ProjectDiffBaseline,
  ProjectDiffResolvedBaseline,
} from '../../shared/desktop-contracts.ts'
import { hasHeadCommit, runGit, runGitWithOptions } from './git-runner.ts'
import { getProjectCommitEntry, resolveCommitRevision } from './project-commits.ts'
import { isGitRepository } from './project-state.ts'
import { captureWorktreeTree, EMPTY_TREE_OID } from './worktree-snapshot.ts'

const remoteHeadRefPattern = /^refs\/remotes\/(?:upstream|origin)\/(.+)$/
const lsRemoteHeadRefPattern = /^ref:\s+refs\/heads\/(.+)\s+HEAD$/m

function getLastOpenedBaselineRef(projectId: string, capturedAt: string) {
  const projectHash = createHash('sha1').update(projectId).digest('hex')
  const baselineHash = createHash('sha1').update(`${projectId}:${capturedAt}`).digest('hex')
  return `refs/howcode/diff-baselines/${projectHash}/${baselineHash}`
}

function toResolvedCommitBaseline(
  kind: Extract<
    ProjectDiffBaseline['kind'],
    'head' | 'previous' | 'main-branch' | 'dev-branch' | 'parent-branch' | 'branch' | 'commit'
  >,
  entry: Awaited<ReturnType<typeof getProjectCommitEntry>>,
): ProjectDiffResolvedBaseline {
  return {
    kind,
    rev: entry?.sha ?? EMPTY_TREE_OID,
    label: entry?.subject ?? (kind === 'head' ? 'HEAD' : 'Commit'),
    commitSha: entry?.sha ?? null,
    shortSha: entry?.shortSha ?? null,
    subject: entry?.subject ?? null,
    committedAt: entry?.committedAt ?? null,
    capturedAt: null,
  }
}

async function resolveFirstExistingRef(projectId: string, candidateRefs: string[]) {
  for (const ref of candidateRefs) {
    const resolvedRef = await resolveCommitRevision(projectId, ref)
    if (resolvedRef) {
      return { ref, resolvedRef }
    }
  }

  return null
}

function getBranchNameFromRemoteHeadRef(ref: string) {
  const match = ref.trim().match(remoteHeadRefPattern)
  const branchName = match?.[1]?.trim()
  return branchName && branchName !== 'HEAD' ? branchName : null
}

function getBranchNameFromLsRemoteHead(output: string) {
  const match = output.match(lsRemoteHeadRefPattern)
  const branchName = match?.[1]?.trim()
  return branchName && branchName !== 'HEAD' ? branchName : null
}

async function getRemoteDefaultBranchName(projectId: string) {
  for (const remote of ['upstream', 'origin']) {
    try {
      const { stdout } = await runGitWithOptions(
        projectId,
        ['symbolic-ref', `refs/remotes/${remote}/HEAD`],
        {
          timeout: 10_000,
          maxBuffer: 1024 * 128,
        },
      )
      const branchName = getBranchNameFromRemoteHeadRef(stdout)
      if (branchName) return { remote, branchName }
    } catch {
      // Some repos do not have remote HEAD refs locally. Fall back below.
    }
  }

  for (const remote of ['upstream', 'origin']) {
    try {
      const { stdout } = await runGitWithOptions(
        projectId,
        ['ls-remote', '--symref', remote, 'HEAD'],
        {
          timeout: 10_000,
          maxBuffer: 1024 * 128,
        },
      )
      const branchName = getBranchNameFromLsRemoteHead(stdout)
      if (branchName) return { remote, branchName }
    } catch {
      // Offline repos can still use local main/master fallbacks below.
    }
  }

  return null
}

async function getDefaultBranchCandidates(projectId: string) {
  const remoteDefault = await getRemoteDefaultBranchName(projectId)
  const symbolicCandidates = remoteDefault
    ? [
        `refs/remotes/${remoteDefault.remote}/${remoteDefault.branchName}`,
        `refs/heads/${remoteDefault.branchName}`,
      ]
    : []

  return [
    ...symbolicCandidates,
    'refs/heads/main',
    'refs/remotes/origin/main',
    'refs/remotes/upstream/main',
    'refs/heads/master',
    'refs/remotes/origin/master',
    'refs/remotes/upstream/master',
  ]
}

async function resolveMergeBaseRevision(projectId: string, targetRev: string) {
  if (!(await hasHeadCommit(projectId))) {
    return EMPTY_TREE_OID
  }

  try {
    const { stdout } = await runGitWithOptions(projectId, ['merge-base', 'HEAD', targetRev], {
      timeout: 10_000,
      maxBuffer: 1024 * 128,
    })

    const mergeBaseRev = stdout.trim()
    return mergeBaseRev.length > 0 ? mergeBaseRev : null
  } catch {
    return null
  }
}

async function resolveNamedBranchBaseline(
  projectId: string,
  options: {
    kind: Extract<
      ProjectDiffBaseline['kind'],
      'main-branch' | 'dev-branch' | 'parent-branch' | 'branch'
    >
    label: string
    candidateRefs: string[]
  },
): Promise<ProjectDiffResolvedBaseline> {
  const resolvedTarget = await resolveFirstExistingRef(projectId, options.candidateRefs)
  if (!resolvedTarget) {
    if (options.kind === 'main-branch') return resolveHeadBaseline(projectId)
    throw new Error(`Could not find ${options.label.toLowerCase()}.`)
  }

  const mergeBaseRev = await resolveMergeBaseRevision(projectId, resolvedTarget.resolvedRef)
  if (!mergeBaseRev) {
    throw new Error(`Could not determine merge base with ${options.label.toLowerCase()}.`)
  }

  if (mergeBaseRev === EMPTY_TREE_OID) {
    return {
      kind: options.kind,
      rev: EMPTY_TREE_OID,
      label: options.label,
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    }
  }

  const entry = await getProjectCommitEntry(projectId, mergeBaseRev)
  if (!entry) {
    throw new Error(`Could not load merge base for ${options.label.toLowerCase()}.`)
  }

  return {
    ...toResolvedCommitBaseline(options.kind, entry),
    label: options.label,
  }
}

async function resolveParentBranchBaseline(
  projectId: string,
  branchName: string,
): Promise<ProjectDiffResolvedBaseline> {
  const trimmedBranchName = branchName.trim()
  if (trimmedBranchName.length === 0) {
    throw new Error('Could not find parent branch.')
  }

  return resolveNamedBranchBaseline(projectId, {
    kind: 'parent-branch',
    label: `Parent branch · ${trimmedBranchName}`,
    candidateRefs: [
      `refs/heads/${trimmedBranchName}`,
      `refs/remotes/origin/${trimmedBranchName}`,
      `refs/remotes/upstream/${trimmedBranchName}`,
    ],
  })
}

async function resolveBranchBaseline(
  projectId: string,
  branchName: string,
): Promise<ProjectDiffResolvedBaseline> {
  const trimmedBranchName = branchName.trim()
  if (trimmedBranchName.length === 0) {
    throw new Error('Could not find branch.')
  }

  return resolveNamedBranchBaseline(projectId, {
    kind: 'branch',
    label: `Branch · ${trimmedBranchName}`,
    candidateRefs: [
      `refs/heads/${trimmedBranchName}`,
      `refs/remotes/origin/${trimmedBranchName}`,
      `refs/remotes/upstream/${trimmedBranchName}`,
    ],
  })
}

async function resolveHeadBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  const entry = await getProjectCommitEntry(projectId, 'HEAD')
  if (!entry) {
    return {
      kind: 'head',
      rev: EMPTY_TREE_OID,
      label: 'Initial state',
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    }
  }

  return toResolvedCommitBaseline('head', entry)
}

async function resolvePreviousCommitBaseline(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline> {
  const entry = await getProjectCommitEntry(projectId, 'HEAD^')
  if (!entry) {
    return {
      kind: 'previous',
      rev: EMPTY_TREE_OID,
      label: 'Initial state',
      commitSha: null,
      shortSha: null,
      subject: null,
      committedAt: null,
      capturedAt: null,
    }
  }

  return {
    ...toResolvedCommitBaseline('previous', entry),
    label: 'Previous commit',
  }
}

async function resolveMainBranchBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  return resolveNamedBranchBaseline(projectId, {
    kind: 'main-branch',
    label: 'Default branch',
    candidateRefs: await getDefaultBranchCandidates(projectId),
  })
}

async function resolveDevBranchBaseline(projectId: string): Promise<ProjectDiffResolvedBaseline> {
  return resolveNamedBranchBaseline(projectId, {
    kind: 'dev-branch',
    label: 'Dev branch',
    candidateRefs: ['refs/heads/dev', 'refs/remotes/origin/dev', 'refs/remotes/upstream/dev'],
  })
}

async function resolveChosenCommitBaseline(
  projectId: string,
  sha: string,
): Promise<ProjectDiffResolvedBaseline> {
  const trimmedSha = sha.trim()
  if (trimmedSha.length === 0) {
    throw new Error('Could not find the selected commit.')
  }

  const resolvedSha = await resolveCommitRevision(projectId, trimmedSha)
  if (!resolvedSha) {
    throw new Error(`Could not find commit ${trimmedSha}.`)
  }

  const entry = await getProjectCommitEntry(projectId, resolvedSha)
  if (!entry) {
    throw new Error(`Could not load commit ${trimmedSha}.`)
  }

  return toResolvedCommitBaseline('commit', entry)
}

async function resolveLastOpenedBaseline(
  projectId: string,
  baseline: Extract<ProjectDiffBaseline, { kind: 'last-opened' }>,
): Promise<ProjectDiffResolvedBaseline> {
  if (baseline.rev.trim().length === 0) {
    throw new Error('No diff baseline has been captured for this project yet.')
  }

  let resolvedRev = ''

  try {
    ;({ stdout: resolvedRev } = await runGitWithOptions(
      projectId,
      ['rev-parse', '--verify', baseline.rev],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      },
    ))
  } catch {
    resolvedRev = ''
  }

  if (resolvedRev.trim().length === 0) {
    return resolveHeadBaseline(projectId)
  }

  return {
    kind: 'last-opened',
    rev: resolvedRev.trim(),
    label: 'Last opened',
    commitSha: null,
    shortSha: null,
    subject: null,
    committedAt: null,
    capturedAt: baseline.capturedAt ?? null,
  }
}

export async function captureProjectDiffBaseline(
  projectId: string,
): Promise<ProjectDiffResolvedBaseline | null> {
  if (!(await isGitRepository(projectId))) {
    return null
  }

  const treeRev = await captureWorktreeTree(projectId)
  const capturedAt = new Date().toISOString()
  const baselineRef = getLastOpenedBaselineRef(projectId, capturedAt)
  const repositoryHasHead = await hasHeadCommit(projectId)

  const commitArgs = [
    'commit-tree',
    treeRev,
    ...(repositoryHasHead ? ['-p', 'HEAD'] : []),
    '-m',
    `howcode diff baseline capturedAt=${capturedAt}`,
  ]

  const { stdout } = await runGitWithOptions(projectId, commitArgs, {
    timeout: 10_000,
    maxBuffer: 1024 * 128,
  })
  const commitRev = stdout.trim()

  if (commitRev.length > 0) {
    await runGit(projectId, ['update-ref', baselineRef, commitRev])
  }

  return {
    kind: 'last-opened',
    rev: commitRev.length > 0 ? baselineRef : EMPTY_TREE_OID,
    label: 'Last opened',
    commitSha: null,
    shortSha: null,
    subject: null,
    committedAt: null,
    capturedAt,
  }
}

export async function resolveProjectDiffBaseline(
  projectId: string,
  baseline?: ProjectDiffBaseline | null,
): Promise<ProjectDiffResolvedBaseline> {
  if (!(await isGitRepository(projectId))) {
    throw new Error('This project is not a git repository.')
  }

  const requestedBaseline = baseline ?? { kind: 'head' }

  switch (requestedBaseline.kind) {
    case 'head':
      return resolveHeadBaseline(projectId)
    case 'previous':
      return resolvePreviousCommitBaseline(projectId)
    case 'last-opened':
      return resolveLastOpenedBaseline(projectId, requestedBaseline)
    case 'main-branch':
      return resolveMainBranchBaseline(projectId)
    case 'dev-branch':
      return resolveDevBranchBaseline(projectId)
    case 'parent-branch':
      return resolveParentBranchBaseline(projectId, requestedBaseline.branchName)
    case 'branch':
      return resolveBranchBaseline(projectId, requestedBaseline.branchName)
    case 'commit':
      return resolveChosenCommitBaseline(projectId, requestedBaseline.sha)
    default:
      return resolveHeadBaseline(projectId)
  }
}
