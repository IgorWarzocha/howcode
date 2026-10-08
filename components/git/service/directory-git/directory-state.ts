import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { databaseOperation } from '../../../../desktop/chat-repository/db.ts'
import type { DirectoryGitState } from '../../../../shared/desktop-contracts.ts'
import { hasHeadCommit, runGit, runGitWithOptions } from './git-runner.ts'
import { loadGitWorktrees } from './worktrees.ts'

const shortStatInsertionsPattern = /(\d+)\s+insertions?\(\+\)/
const shortStatDeletionsPattern = /(\d+)\s+deletions?\(-\)/
const trailingSlashPattern = /\/$/
const originPathSeparatorPattern = /[/:]/
const gitSuffixPattern = /\.git$/i
const remoteHeadRefPattern = /^refs\/remotes\/(?:upstream|origin)\/(.+)$/

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

export async function isGitRepository(directoryId: string) {
  try {
    const { stdout } = await runGit(directoryId, ['rev-parse', '--is-inside-work-tree'])
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

async function getStatusSummary(directoryId: string) {
  try {
    const { stdout } = await runGitWithOptions(directoryId, ['status', '--short', '--branch'], {
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

export async function getOriginUrl(directoryId: string) {
  try {
    const { stdout } = await runGit(directoryId, ['remote', 'get-url', 'origin'])
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

const getDirectoryGitOpsModeOverrideOperation = Effect.fn(
  'DirectoryGitState.getGitOpsModeOverride',
)(function* (directoryId: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe<{ gitOpsMode?: string | null }>(
    `
        SELECT git_ops_mode AS gitOpsMode
        FROM projects
        WHERE cwd = ?
      `,
    [directoryId],
  )
  const row = rows[0]

  return row?.gitOpsMode === 'commit' || row?.gitOpsMode === 'commit-push' ? row.gitOpsMode : null
})

const getDirectoryGitOpsModeOverride = databaseOperation(getDirectoryGitOpsModeOverrideOperation)

export async function getActiveBranch(directoryId: string) {
  try {
    const { stdout } = await runGit(directoryId, ['branch', '--show-current'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export async function getBranch(directoryId: string) {
  const activeBranch = await getActiveBranch(directoryId)
  if (activeBranch) return activeBranch

  try {
    if (await hasHeadCommit(directoryId)) {
      const { stdout } = await runGit(directoryId, ['rev-parse', '--short', 'HEAD'])
      return stdout.trim() || null
    }
  } catch {
    return null
  }

  return null
}

async function getBranches(directoryId: string) {
  try {
    const { stdout } = await runGitWithOptions(
      directoryId,
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

async function getDefaultBranchName(directoryId: string, branches: readonly string[]) {
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
      if (branchName) return branchName
    } catch {
      // Remote HEAD can be missing in freshly-created or offline repos.
    }
  }

  return branches.find((branch) => branch === 'main' || branch === 'master') ?? null
}

async function getDevBranchName(directoryId: string, branches: readonly string[]) {
  if (branches.includes('dev')) return 'dev'

  for (const ref of ['refs/remotes/origin/dev', 'refs/remotes/upstream/dev']) {
    try {
      await runGitWithOptions(directoryId, ['show-ref', '--verify', ref], {
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

async function getMainBranchName(directoryId: string, branches: readonly string[]) {
  for (const branch of ['main', 'master']) {
    if (branches.includes(branch)) return branch

    for (const ref of [`refs/remotes/origin/${branch}`, `refs/remotes/upstream/${branch}`]) {
      try {
        await runGitWithOptions(directoryId, ['show-ref', '--verify', ref], {
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

async function getDiffStats(directoryId: string) {
  try {
    const args = (await hasHeadCommit(directoryId))
      ? ['diff', '--shortstat', 'HEAD', '--']
      : ['diff', '--cached', '--shortstat', '--root', '--']
    const { stdout } = await runGitWithOptions(directoryId, args, {
      timeout: 10_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return parseShortStat(stdout)
  } catch {
    return { insertions: 0, deletions: 0 }
  }
}

export async function loadDirectoryGitState(directoryId: string): Promise<DirectoryGitState> {
  const gitOpsModeOverride = getDirectoryGitOpsModeOverride(directoryId)

  if (!(await isGitRepository(directoryId))) {
    return {
      directoryId,
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
    getBranch(directoryId),
    getBranches(directoryId),
    getStatusSummary(directoryId),
    getOriginUrl(directoryId),
    getDiffStats(directoryId),
    loadGitWorktrees(directoryId).catch(() => []),
  ])

  const [defaultBranchName, devBranchName, mainBranchName] = await Promise.all([
    getDefaultBranchName(directoryId, branches),
    getDevBranchName(directoryId, branches),
    getMainBranchName(directoryId, branches),
  ])

  return {
    directoryId,
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
