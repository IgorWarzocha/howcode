import type { ProjectGitState } from '../../shared/desktop-contracts.ts'
import { getThreadStateDatabase } from '../thread-state-db/db.ts'
import { hasHeadCommit, runGit, runGitWithOptions } from './git-runner.ts'
import { loadGitWorktrees } from './worktrees.ts'

const shortStatInsertionsPattern = /(\d+)\s+insertions?\(\+\)/
const shortStatDeletionsPattern = /(\d+)\s+deletions?\(-\)/
const trailingSlashPattern = /\/$/
const originPathSeparatorPattern = /[/:]/
const gitSuffixPattern = /\.git$/i
const remoteHeadRefPattern = /^refs\/remotes\/(?:upstream|origin)\/(.+)$/
const lsRemoteHeadRefPattern = /^ref:\s+refs\/heads\/(.+)\s+HEAD$/m

function parseShortStat(output: string) {
  const insertionsMatch = output.match(shortStatInsertionsPattern)
  const deletionsMatch = output.match(shortStatDeletionsPattern)

  return {
    insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1] ?? '0', 10) : 0,
    deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1] ?? '0', 10) : 0,
  }
}

function parseStatusSummary(output: string) {
  let fileCount = 0
  let stagedFileCount = 0
  let unstagedFileCount = 0
  let untrackedFileCount = 0

  for (const line of output.split('\n')) {
    if (!line || line.startsWith('## ')) {
      continue
    }

    fileCount += 1

    if (line.startsWith('??')) {
      unstagedFileCount += 1
      untrackedFileCount += 1
      continue
    }

    const stagedStatus = line[0] ?? ' '
    const unstagedStatus = line[1] ?? ' '

    if (stagedStatus !== ' ') {
      stagedFileCount += 1
    }

    if (unstagedStatus !== ' ') {
      unstagedFileCount += 1
    }
  }

  return {
    fileCount,
    stagedFileCount,
    unstagedFileCount,
    untrackedFileCount,
  }
}

export async function isGitRepository(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ['rev-parse', '--is-inside-work-tree'])
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

async function getStatusSummary(projectId: string) {
  try {
    const { stdout } = await runGitWithOptions(projectId, ['status', '--short', '--branch'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return parseStatusSummary(stdout)
  } catch {
    return {
      fileCount: 0,
      stagedFileCount: 0,
      unstagedFileCount: 0,
      untrackedFileCount: 0,
    }
  }
}

export async function getOriginUrl(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ['remote', 'get-url', 'origin'])
    const originUrl = stdout.trim()
    return originUrl.length > 0 ? originUrl : null
  } catch {
    return null
  }
}

function deriveOriginName(originUrl: string | null) {
  if (!originUrl) {
    return null
  }

  const normalizedUrl = originUrl.replace(trailingSlashPattern, '')
  const parts = normalizedUrl.split(originPathSeparatorPattern).filter((part) => part.length > 0)
  const lastPart = parts.at(-1) ?? originUrl
  return lastPart.replace(gitSuffixPattern, '') || 'origin'
}

function getProjectGitOpsModeOverride(projectId: string) {
  const row = getThreadStateDatabase()
    .prepare(
      `
        SELECT git_ops_mode AS gitOpsMode
        FROM projects
        WHERE cwd = ?
      `,
    )
    .get(projectId) as { gitOpsMode?: string | undefined | null | undefined } | undefined

  return row?.gitOpsMode === 'commit' || row?.gitOpsMode === 'commit-push' ? row.gitOpsMode : null
}

export async function getBranch(projectId: string) {
  try {
    const { stdout } = await runGit(projectId, ['branch', '--show-current'])
    const branch = stdout.trim()
    if (branch) {
      return branch
    }
  } catch {
    // Fallback below.
  }

  try {
    if (await hasHeadCommit(projectId)) {
      const { stdout } = await runGit(projectId, ['rev-parse', '--short', 'HEAD'])
      return stdout.trim() || null
    }
  } catch {
    return null
  }

  return null
}

async function getBranches(projectId: string) {
  try {
    const { stdout } = await runGitWithOptions(
      projectId,
      ['branch', '--format=%(refname:short)', '--sort=-committerdate'],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      },
    )
    return stdout
      .split('\n')
      .map((branch) => branch.trim())
      .filter((branch) => branch.length > 0)
  } catch {
    return []
  }
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

async function getDefaultBranchName(projectId: string, branches: readonly string[]) {
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
      if (branchName) return branchName
    } catch {
      // Offline repos can still use locally cached remote HEAD refs below.
    }

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
      if (branchName) return branchName
    } catch {
      // Remote HEAD can be missing in freshly-created or offline repos.
    }
  }

  return branches.find((branch) => branch === 'main' || branch === 'master') ?? null
}

async function getDevBranchName(projectId: string, branches: readonly string[]) {
  if (branches.includes('dev')) return 'dev'

  for (const ref of ['refs/remotes/origin/dev', 'refs/remotes/upstream/dev']) {
    try {
      await runGitWithOptions(projectId, ['show-ref', '--verify', ref], {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      })
      return 'dev'
    } catch {
      // Try the next remote.
    }
  }

  return null
}

async function getMainBranchName(projectId: string, branches: readonly string[]) {
  for (const branch of ['main', 'master']) {
    if (branches.includes(branch)) return branch

    for (const ref of [`refs/remotes/origin/${branch}`, `refs/remotes/upstream/${branch}`]) {
      try {
        await runGitWithOptions(projectId, ['show-ref', '--verify', ref], {
          timeout: 10_000,
          maxBuffer: 1024 * 128,
        })
        return branch
      } catch {
        // Try the next branch/ref.
      }
    }
  }

  return null
}

async function getDiffStats(projectId: string) {
  try {
    const args = (await hasHeadCommit(projectId))
      ? ['diff', '--shortstat', 'HEAD', '--']
      : ['diff', '--cached', '--shortstat', '--root', '--']
    const { stdout } = await runGitWithOptions(projectId, args, {
      timeout: 10_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return parseShortStat(stdout)
  } catch {
    return { insertions: 0, deletions: 0 }
  }
}

export async function loadProjectGitState(projectId: string): Promise<ProjectGitState> {
  const gitOpsModeOverride = getProjectGitOpsModeOverride(projectId)

  if (!(await isGitRepository(projectId))) {
    return {
      projectId,
      isGitRepo: false,
      branch: null,
      branches: [],
      defaultBranchName: null,
      devBranchName: null,
      mainBranchName: null,
      fileCount: 0,
      stagedFileCount: 0,
      unstagedFileCount: 0,
      untrackedFileCount: 0,
      insertions: 0,
      deletions: 0,
      hasOrigin: false,
      originName: null,
      originUrl: null,
      gitOpsModeOverride,
      worktrees: [],
    }
  }

  const [branch, branches, statusSummary, originUrl, stats, worktrees] = await Promise.all([
    getBranch(projectId),
    getBranches(projectId),
    getStatusSummary(projectId),
    getOriginUrl(projectId),
    getDiffStats(projectId),
    loadGitWorktrees(projectId).catch(() => []),
  ])

  const [defaultBranchName, devBranchName, mainBranchName] = await Promise.all([
    getDefaultBranchName(projectId, branches),
    getDevBranchName(projectId, branches),
    getMainBranchName(projectId, branches),
  ])

  return {
    projectId,
    isGitRepo: true,
    branch,
    branches,
    defaultBranchName,
    devBranchName,
    mainBranchName,
    fileCount: statusSummary.fileCount,
    stagedFileCount: statusSummary.stagedFileCount,
    unstagedFileCount: statusSummary.unstagedFileCount,
    untrackedFileCount: statusSummary.untrackedFileCount,
    insertions: stats.insertions,
    deletions: stats.deletions,
    hasOrigin: originUrl !== null,
    originName: deriveOriginName(originUrl),
    originUrl,
    gitOpsModeOverride,
    worktrees,
  }
}
