import { createHash } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

const stagedWorktreeQueues = new Map<string, Promise<unknown>>()
const stagedWorktreeLockRoot = join(tmpdir(), 'howcode-git-worktree-locks')
const stagedWorktreeLockStaleMs = 120_000
const stagedWorktreeLockPollMs = 50
const stagedWorktreeLockTimeoutMs = 30_000

function getStagedWorktreeLockPath(projectId: string) {
  const lockKey = createHash('sha1').update(projectId).digest('hex')
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

async function acquireStagedWorktreeLock(projectId: string) {
  await mkdir(stagedWorktreeLockRoot, { recursive: true })
  const lockPath = getStagedWorktreeLockPath(projectId)
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

async function runWithProcessStagedWorktreeLock<T>(projectId: string, operation: () => Promise<T>) {
  const release = await acquireStagedWorktreeLock(projectId)
  try {
    return await operation()
  } finally {
    await release()
  }
}

function runExclusiveStagedWorktree<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
  const previous = stagedWorktreeQueues.get(projectId) ?? Promise.resolve()
  const next = previous.then(
    () => runWithProcessStagedWorktreeLock(projectId, operation),
    () => runWithProcessStagedWorktreeLock(projectId, operation),
  )
  const cleanup = next.finally(() => {
    if (stagedWorktreeQueues.get(projectId) === cleanup) {
      stagedWorktreeQueues.delete(projectId)
    }
  })
  stagedWorktreeQueues.set(projectId, cleanup)
  return next
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
  projectId: string,
  callback: (context: { env: NodeJS.ProcessEnv; hasHead: boolean; treeOid: string }) => Promise<T>,
) {
  return runExclusiveStagedWorktree(projectId, () =>
    withTemporaryIndex(projectId, async ({ env, hasHead }) => {
      await runGitWithOptions(projectId, ['add', '-A', '--', '.'], {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 8,
      })

      const { stdout } = await runGitWithOptions(projectId, ['write-tree'], {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 128,
      })

      const treeOid = stdout.trim() || (hasHead ? 'HEAD^{tree}' : EMPTY_TREE_OID)
      return callback({ env, hasHead, treeOid })
    }),
  )
}

export async function captureWorktreeTree(projectId: string): Promise<string> {
  return withStagedWorktree(projectId, async ({ treeOid }) => treeOid)
}

async function loadTrackedWorktreeSnapshot(
  projectId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    hasHead?: boolean | undefined
    signal?: AbortSignal | undefined
    onPatchChunk?: ((chunk: string) => void) | undefined
  } = {},
): Promise<WorktreeSnapshot> {
  const baselineRev = options.baselineRev?.trim() || (options.hasHead ? 'HEAD' : EMPTY_TREE_OID)
  const diffArguments = (extraArgs: string[]) => ['diff', ...extraArgs, baselineRev, '--']
  const patchPromise = runGitStreamingWithOptions(
    projectId,
    diffArguments(['--unified=1', '--no-color', '--no-ext-diff', '--find-renames']),
    {
      timeout: 20_000,
      signal: options.signal,
      onStdoutChunk: options.onPatchChunk ?? (() => undefined),
    },
  ).then(({ stdout }) => stdout.trim())
  const statsPromise = loadWorktreeStats(projectId, {
    baselineRev,
    hasHead: options.hasHead,
    includeUntracked: false,
  })

  const [stats, patchOutput] = await Promise.all([statsPromise, patchPromise])
  return { ...stats, patch: patchOutput }
}

async function loadStagedWorktreeSnapshot(
  projectId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    signal?: AbortSignal | undefined
    onPatchChunk?: ((chunk: string) => void) | undefined
  } = {},
): Promise<WorktreeSnapshot> {
  return withStagedWorktree(projectId, async ({ env, hasHead }) => {
    const baselineRev = options.baselineRev?.trim() || (hasHead ? 'HEAD' : EMPTY_TREE_OID)
    const diffArguments = (extraArgs: string[]) => [
      'diff',
      '--cached',
      ...extraArgs,
      baselineRev,
      '--',
    ]

    const patchPromise = runGitStreamingWithOptions(
      projectId,
      diffArguments(['--unified=1', '--no-color', '--no-ext-diff', '--find-renames']),
      {
        env,
        timeout: 20_000,
        signal: options.signal,
        onStdoutChunk: options.onPatchChunk ?? (() => undefined),
      },
    ).then(({ stdout }) => stdout.trim())

    const statsPromise = loadWorktreeStats(projectId, {
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
  projectId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    includeUntracked?: boolean | undefined
    signal?: AbortSignal | undefined
    onPatchChunk?: ((chunk: string) => void) | undefined
  } = {},
): Promise<WorktreeSnapshot> {
  return options.includeUntracked
    ? loadStagedWorktreeSnapshot(projectId, options)
    : loadTrackedWorktreeSnapshot(projectId, options)
}

export async function loadWorktreeStats(
  projectId: string,
  options: {
    baselineRev?: string | undefined | null | undefined
    env?: NodeJS.ProcessEnv
    hasHead?: boolean | undefined
    includeUntracked?: boolean | undefined
  } = {},
): Promise<WorktreeStats> {
  const loadStats = async (context?: {
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
      ...(options.includeUntracked ? ['--cached'] : []),
      ...extraArgs,
      baselineRev,
      '--',
    ]

    const numStatOutput = await runGitWithOptions(
      projectId,
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

  if (options.env || !options.includeUntracked) {
    const context = options.env
      ? { env: options.env, hasHead: options.hasHead ?? false }
      : { hasHead: options.hasHead ?? false }
    return loadStats(context)
  }

  return runExclusiveStagedWorktree(projectId, () =>
    withTemporaryIndex(projectId, async ({ env, hasHead }) => {
      await runGitWithOptions(projectId, ['add', '-A', '--', '.'], {
        env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 8,
      })

      return loadStats({ env, hasHead })
    }),
  )
}
