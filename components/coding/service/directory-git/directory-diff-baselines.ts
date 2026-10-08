import { createHash } from 'node:crypto'
import type {
  DirectoryDiffBaseline,
  DirectoryDiffResolvedBaseline,
} from '../../../../shared/desktop-contracts.ts'
import { getDirectoryCommitEntry, resolveCommitRevision } from './directory-commits.ts'
import { isGitRepository } from './directory-state.ts'
import { hasHeadCommit, runGit, runGitWithOptions } from './git-runner.ts'
import { captureWorktreeTree, EMPTY_TREE_OID } from './worktree-snapshot.ts'

const remoteHeadRefPattern = /^refs\/remotes\/(?:upstream|origin)\/(.+)$/
const lsRemoteHeadRefPattern = /^ref:\s+refs\/heads\/(.+)\s+HEAD$/m

function getLastOpenedBaselineRef(directoryId: string, capturedAt: string) {
  const directoryHash = createHash('sha1').update(directoryId).digest('hex')
  const baselineHash = createHash('sha1').update(`${directoryId}:${capturedAt}`).digest('hex')
  return `refs/howcode/diff-baselines/${directoryHash}/${baselineHash}`
}

function toResolvedCommitBaseline(
  kind: Extract<
    DirectoryDiffBaseline['kind'],
    'head' | 'previous' | 'main-branch' | 'dev-branch' | 'parent-branch' | 'branch' | 'commit'
  >,
  entry: Awaited<ReturnType<typeof getDirectoryCommitEntry>>,
): DirectoryDiffResolvedBaseline {
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

async function resolveFirstExistingRef(directoryId: string, candidateRefs: string[]) {
  for (const ref of candidateRefs) {
    const resolvedRef = await resolveCommitRevision(directoryId, ref)
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

async function getRemoteDefaultBranchName(directoryId: string) {
  for (const remote of ['upstream', 'origin']) {
    try {
      const { stdout } = await runGitWithOptions(
        directoryId,
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
        directoryId,
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

async function getDefaultBranchCandidates(directoryId: string) {
  const remoteDefault = await getRemoteDefaultBranchName(directoryId)
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

async function resolveMergeBaseRevision(directoryId: string, targetRev: string) {
  if (!(await hasHeadCommit(directoryId))) {
    return EMPTY_TREE_OID
  }

  try {
    const { stdout } = await runGitWithOptions(directoryId, ['merge-base', 'HEAD', targetRev], {
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
  directoryId: string,
  options: {
    kind: Extract<
      DirectoryDiffBaseline['kind'],
      'main-branch' | 'dev-branch' | 'parent-branch' | 'branch'
    >
    label: string
    candidateRefs: string[]
  },
): Promise<DirectoryDiffResolvedBaseline> {
  const resolvedTarget = await resolveFirstExistingRef(directoryId, options.candidateRefs)
  if (!resolvedTarget) {
    if (options.kind === 'main-branch') return resolveHeadBaseline(directoryId)
    throw new Error(`Could not find ${options.label.toLowerCase()}.`)
  }

  const mergeBaseRev = await resolveMergeBaseRevision(directoryId, resolvedTarget.resolvedRef)
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

  const entry = await getDirectoryCommitEntry(directoryId, mergeBaseRev)
  if (!entry) {
    throw new Error(`Could not load merge base for ${options.label.toLowerCase()}.`)
  }

  return {
    ...toResolvedCommitBaseline(options.kind, entry),
    label: options.label,
  }
}

async function resolveParentBranchBaseline(
  directoryId: string,
  branchName: string,
): Promise<DirectoryDiffResolvedBaseline> {
  const trimmedBranchName = branchName.trim()
  if (trimmedBranchName.length === 0) {
    throw new Error('Could not find parent branch.')
  }

  return resolveNamedBranchBaseline(directoryId, {
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
  directoryId: string,
  branchName: string,
): Promise<DirectoryDiffResolvedBaseline> {
  const trimmedBranchName = branchName.trim()
  if (trimmedBranchName.length === 0) {
    throw new Error('Could not find branch.')
  }

  return resolveNamedBranchBaseline(directoryId, {
    kind: 'branch',
    label: `Branch · ${trimmedBranchName}`,
    candidateRefs: [
      `refs/heads/${trimmedBranchName}`,
      `refs/remotes/origin/${trimmedBranchName}`,
      `refs/remotes/upstream/${trimmedBranchName}`,
    ],
  })
}

async function resolveHeadBaseline(directoryId: string): Promise<DirectoryDiffResolvedBaseline> {
  const entry = await getDirectoryCommitEntry(directoryId, 'HEAD')
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
  directoryId: string,
): Promise<DirectoryDiffResolvedBaseline> {
  const entry = await getDirectoryCommitEntry(directoryId, 'HEAD^')
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

async function resolveMainBranchBaseline(
  directoryId: string,
): Promise<DirectoryDiffResolvedBaseline> {
  return resolveNamedBranchBaseline(directoryId, {
    kind: 'main-branch',
    label: 'Default branch',
    candidateRefs: await getDefaultBranchCandidates(directoryId),
  })
}

async function resolveDevBranchBaseline(
  directoryId: string,
): Promise<DirectoryDiffResolvedBaseline> {
  return resolveNamedBranchBaseline(directoryId, {
    kind: 'dev-branch',
    label: 'Dev branch',
    candidateRefs: ['refs/heads/dev', 'refs/remotes/origin/dev', 'refs/remotes/upstream/dev'],
  })
}

async function resolveChosenCommitBaseline(
  directoryId: string,
  sha: string,
): Promise<DirectoryDiffResolvedBaseline> {
  const trimmedSha = sha.trim()
  if (trimmedSha.length === 0) {
    throw new Error('Could not find the selected commit.')
  }

  const resolvedSha = await resolveCommitRevision(directoryId, trimmedSha)
  if (!resolvedSha) {
    throw new Error(`Could not find commit ${trimmedSha}.`)
  }

  const entry = await getDirectoryCommitEntry(directoryId, resolvedSha)
  if (!entry) {
    throw new Error(`Could not load commit ${trimmedSha}.`)
  }

  return toResolvedCommitBaseline('commit', entry)
}

async function resolveLastOpenedBaseline(
  directoryId: string,
  baseline: Extract<DirectoryDiffBaseline, { kind: 'last-opened' }>,
): Promise<DirectoryDiffResolvedBaseline> {
  if (baseline.rev.trim().length === 0) {
    throw new Error('No diff baseline has been captured for this project yet.')
  }

  let resolvedRev = ''

  try {
    ;({ stdout: resolvedRev } = await runGitWithOptions(
      directoryId,
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
    return resolveHeadBaseline(directoryId)
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

export async function captureDirectoryDiffBaseline(
  directoryId: string,
): Promise<DirectoryDiffResolvedBaseline | null> {
  if (!(await isGitRepository(directoryId))) {
    return null
  }

  const treeRev = await captureWorktreeTree(directoryId)
  const capturedAt = new Date().toISOString()
  const baselineRef = getLastOpenedBaselineRef(directoryId, capturedAt)
  const repositoryHasHead = await hasHeadCommit(directoryId)

  const commitArgs = [
    'commit-tree',
    treeRev,
    ...(repositoryHasHead ? ['-p', 'HEAD'] : []),
    '-m',
    `howcode diff baseline capturedAt=${capturedAt}`,
  ]

  const { stdout } = await runGitWithOptions(directoryId, commitArgs, {
    timeout: 10_000,
    maxBuffer: 1024 * 128,
  })
  const commitRev = stdout.trim()

  if (commitRev.length > 0) {
    await runGit(directoryId, ['update-ref', baselineRef, commitRev])
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

export async function resolveDirectoryDiffBaseline(
  directoryId: string,
  baseline?: DirectoryDiffBaseline | null,
): Promise<DirectoryDiffResolvedBaseline> {
  if (!(await isGitRepository(directoryId))) {
    throw new Error('This project is not a git repository.')
  }

  const requestedBaseline = baseline ?? { kind: 'head' }

  switch (requestedBaseline.kind) {
    case 'head':
      return resolveHeadBaseline(directoryId)
    case 'previous':
      return resolvePreviousCommitBaseline(directoryId)
    case 'last-opened':
      return resolveLastOpenedBaseline(directoryId, requestedBaseline)
    case 'main-branch':
      return resolveMainBranchBaseline(directoryId)
    case 'dev-branch':
      return resolveDevBranchBaseline(directoryId)
    case 'parent-branch':
      return resolveParentBranchBaseline(directoryId, requestedBaseline.branchName)
    case 'branch':
      return resolveBranchBaseline(directoryId, requestedBaseline.branchName)
    case 'commit':
      return resolveChosenCommitBaseline(directoryId, requestedBaseline.sha)
    default:
      return resolveHeadBaseline(directoryId)
  }
}
