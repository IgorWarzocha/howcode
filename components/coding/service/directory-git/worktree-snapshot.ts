import { createHash } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runKeyedWorkspaceOperation } from '../keyed-workspace-operations.ts'
import { runGitStreamingWithOptions, runGitWithOptions, withTemporaryIndex } from './git-runner.ts'

export const EMPTY_TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export type WorktreeSnapshot = {
  fileCount: number
  insertions: number
  deletions: number
  diffStat: string
  nameStatus: string
  numStat: string
  patch: string
}

export type WorktreeStats = Omit<WorktreeSnapshot, 'patch'>

const stagedWorktreeLockRoot = join(tmpdir(), 'howcode-git-worktree-locks')
const stagedWorktreeLockStaleMs = 120_000
const stagedWorktreeLockPollMs = 50
const stagedWorktreeLockTimeoutMs = 30_000
const canonicalPatchPrefixes = ['--src-prefix=a/', '--dst-prefix=b/']

function getStagedWorktreeLockPath(directoryId: string) {
  const lockKey = createHash('sha1').update(directoryId).digest('hex')
  return join(stagedWorktreeLockRoot, `${lockKey}.lock`)
}

function waitForStagedWorktreeLock() {
  return new Promise((resolve) => setTimeout(resolve, stagedWorktreeLockPollMs))
}

function isFileAlreadyExistsError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')
}

async function removeStaleStagedWorktreeLock(lockPath: string) {
  try {
    const lockStat = await stat(lockPath)
    if (Date.now() - lockStat.mtimeMs <= stagedWorktreeLockStaleMs) return false
    await rm(lockPath, { force: true, recursive: true })
    return true
  } catch {
    return true
  }
}

async function acquireStagedWorktreeLock(directoryId: string) {
  await mkdir(stagedWorktreeLockRoot, { recursive: true })
  const lockPath = getStagedWorktreeLockPath(directoryId)
  const startedAt = Date.now()

  while (true) {
    try {
      await mkdir(lockPath)
      return async () => {
        await rm(lockPath, { force: true, recursive: true })
      }
    } catch (error) {
      if (!isFileAlreadyExistsError(error)) throw error
      if (await removeStaleStagedWorktreeLock(lockPath)) continue

      if (Date.now() - startedAt > stagedWorktreeLockTimeoutMs) {
        throw new Error('Timed out waiting for staged worktree diff lock.')
      }

      await waitForStagedWorktreeLock()
    }
  }
}

async function runWithProcessStagedWorktreeLock<T>(
  directoryId: string,
  operation: () => Promise<T>,
) {
  const release = await acquireStagedWorktreeLock(directoryId)
  try {
    return await operation()
  } finally {
    await release()
  }
}

function runExclusiveStagedWorktree<T>(
  directoryId: string,
  operation: () => Promise<T>,
): Promise<T> {
  return runKeyedWorkspaceOperation('worktree-snapshot', directoryId, () =>
    runWithProcessStagedWorktreeLock(directoryId, operation),
  )
}

function parseNumStat(output: string) {
  let fileCount = 0
  let insertions = 0
  let deletions = 0

  for (const line of output.split('\n')) {
    const trimmedLine = line.trim()
    if (trimmedLine.length === 0) {
      continue
    }

    fileCount += 1

    const [rawInsertions, rawDeletions] = trimmedLine.split('\t')
    const parsedInsertions = Number.parseInt(rawInsertions ?? '', 10)
    const parsedDeletions = Number.parseInt(rawDeletions ?? '', 10)

    if (!Number.isNaN(parsedInsertions)) {
      insertions += parsedInsertions
    }

    if (!Number.isNaN(parsedDeletions)) {
      deletions += parsedDeletions
    }
  }

  return { fileCount, insertions, deletions }
}

async function withStagedWorktree<T>(
  directoryId: string,
  callback: (context: { env: NodeJS.ProcessEnv; hasHead: boolean; treeOid: string }) => Promise<T>,
) {
  return runExclusiveStagedWorktree(directoryId, () =>
    withTemporaryIndex(directoryId, async ({ env, hasHead }) => {
      await runGitWithOptions(directoryId, ['add', '-A', '--', '.'], {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 8,
      })

      const { stdout } = await runGitWithOptions(directoryId, ['write-tree'], {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 128,
      })

      const treeOid = stdout.trim() || (hasHead ? 'HEAD^{tree}' : EMPTY_TREE_OID)
      return callback({ env, hasHead, treeOid })
    }),
  )
}

export async function captureWorktreeTree(directoryId: string): Promise<string> {
  return withStagedWorktree(directoryId, async ({ treeOid }) => treeOid)
}

async function loadTrackedWorktreeSnapshot(
  directoryId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    signal?: AbortSignal | undefined
    onPatchChunk?: ((chunk: string) => void) | undefined
  } = {},
): Promise<WorktreeSnapshot> {
  return runExclusiveStagedWorktree(directoryId, () =>
    withTemporaryIndex(directoryId, async ({ env, hasHead }) => {
      await runGitWithOptions(directoryId, ['add', '-u', '--', '.'], {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 8,
      })

      const baselineRev = options.baselineRev?.trim() || (hasHead ? 'HEAD' : EMPTY_TREE_OID)
      const diffArguments = (extraArgs: string[]) => [
        'diff',
        '--cached',
        ...extraArgs,
        baselineRev,
        '--',
      ]
      const patchPromise = runGitStreamingWithOptions(
        directoryId,
        diffArguments([
          '--unified=1',
          '--no-color',
          '--no-ext-diff',
          '--find-renames',
          ...canonicalPatchPrefixes,
        ]),
        {
          env,
          timeout: 20_000,
          signal: options.signal,
          onStdoutChunk: options.onPatchChunk ?? (() => undefined),
        },
      ).then(({ stdout }) => stdout.trim())
      const statsPromise = loadWorktreeStats(directoryId, {
        baselineRev,
        env,
        hasHead,
        includeUntracked: false,
      })

      const [stats, patchOutput] = await Promise.all([statsPromise, patchPromise])
      return { ...stats, patch: patchOutput }
    }),
  )
}

async function loadStagedWorktreeSnapshot(
  directoryId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    signal?: AbortSignal | undefined
    onPatchChunk?: ((chunk: string) => void) | undefined
  } = {},
): Promise<WorktreeSnapshot> {
  return withStagedWorktree(directoryId, async ({ env, hasHead }) => {
    const baselineRev = options.baselineRev?.trim() || (hasHead ? 'HEAD' : EMPTY_TREE_OID)
    const diffArguments = (extraArgs: string[]) => [
      'diff',
      '--cached',
      ...extraArgs,
      baselineRev,
      '--',
    ]

    const patchPromise = runGitStreamingWithOptions(
      directoryId,
      diffArguments([
        '--unified=1',
        '--no-color',
        '--no-ext-diff',
        '--find-renames',
        ...canonicalPatchPrefixes,
      ]),
      {
        env,
        timeout: 20_000,
        signal: options.signal,
        onStdoutChunk: options.onPatchChunk ?? (() => undefined),
      },
    ).then(({ stdout }) => stdout.trim())

    const statsPromise = loadWorktreeStats(directoryId, {
      baselineRev,
      env,
      hasHead,
      includeUntracked: true,
    }).catch(() => ({
      fileCount: 0,
      insertions: 0,
      deletions: 0,
      diffStat: '',
      nameStatus: '',
      numStat: '',
    }))

    const [stats, patchOutput] = await Promise.all([statsPromise, patchPromise])

    return {
      ...stats,
      patch: patchOutput,
    }
  })
}

export async function loadWorktreeSnapshot(
  directoryId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    includeUntracked?: boolean | undefined
    signal?: AbortSignal | undefined
    onPatchChunk?: ((chunk: string) => void) | undefined
  } = {},
): Promise<WorktreeSnapshot> {
  return options.includeUntracked
    ? loadStagedWorktreeSnapshot(directoryId, options)
    : loadTrackedWorktreeSnapshot(directoryId, options)
}

export async function loadWorktreeStats(
  directoryId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    env?: NodeJS.ProcessEnv
    hasHead?: boolean | undefined
    includeUntracked?: boolean | undefined
  } = {},
): Promise<WorktreeStats> {
  const loadStats = async (context?: {
    cached?: boolean | undefined
    env?: NodeJS.ProcessEnv
    hasHead?: boolean | undefined
  }) => {
    const hasHead = context?.hasHead ?? false
    const baselineRev =
      context?.hasHead === false
        ? options.baselineRev?.trim() || EMPTY_TREE_OID
        : options.baselineRev?.trim() || (hasHead ? 'HEAD' : EMPTY_TREE_OID)
    const diffArguments = (extraArgs: string[]) => [
      'diff',
      ...(context?.cached ? ['--cached'] : []),
      ...extraArgs,
      baselineRev,
      '--',
    ]

    const numStatOutput = await runGitWithOptions(
      directoryId,
      diffArguments(['--numstat', '--find-renames']),
      {
        env: context?.env ?? process.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    ).then(
      ({ stdout }) => stdout.trim(),
      () => '',
    )

    const numStat = parseNumStat(numStatOutput)

    return {
      fileCount: numStat.fileCount,
      insertions: numStat.insertions,
      deletions: numStat.deletions,
      diffStat: '',
      nameStatus: '',
      numStat: numStatOutput,
    }
  }

  if (options.env) {
    return loadStats({
      cached: options.includeUntracked,
      env: options.env,
      hasHead: options.hasHead ?? false,
    })
  }

  return runExclusiveStagedWorktree(directoryId, () =>
    withTemporaryIndex(directoryId, async ({ env, hasHead }) => {
      await runGitWithOptions(
        directoryId,
        ['add', options.includeUntracked ? '-A' : '-u', '--', '.'],
        {
          env,
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 8,
        },
      )

      return loadStats({ cached: true, env, hasHead })
    }),
  )
}
