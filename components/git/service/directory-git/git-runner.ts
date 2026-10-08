import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

export async function runGit(directoryId: string, args: string[]) {
  return runGitWithOptions(directoryId, args)
}

export async function runGitWithOptions(
  directoryId: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv
    maxBuffer?: number | undefined
    timeout?: number | undefined
  } = {},
) {
  return execFile('git', args, {
    cwd: directoryId,
    env: options.env,
    timeout: options.timeout ?? 3_000,
    maxBuffer: options.maxBuffer ?? 1024 * 128,
  })
}

export function getNonInteractiveGitEnv(baseEnv?: NodeJS.ProcessEnv) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...baseEnv,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
    GIT_ASKPASS: 'echo',
    SSH_ASKPASS: 'echo',
    GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oConnectTimeout=5',
  }
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) {
    if (!Object.hasOwn(baseEnv ?? {}, key)) delete env[key]
  }
  return env
}

export function formatGitCommandError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Git command failed.'
  }

  const details = [
    'stdout' in error && typeof error.stdout === 'string' ? error.stdout.trim() : '',
    'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : '',
    error.message,
  ]
    .find((value) => value.length > 0)
    ?.replace(/\s+/g, ' ')
    .trim()

  return details && details.length > 0 ? details : 'Git command failed.'
}

export async function hasHeadCommit(directoryId: string) {
  try {
    await runGit(directoryId, ['rev-parse', '--verify', 'HEAD'])
    return true
  } catch {
    return false
  }
}

export async function withTemporaryIndex<T>(
  directoryId: string,
  callback: (context: { env: NodeJS.ProcessEnv; hasHead: boolean }) => Promise<T>,
) {
  const tempDir = await mkdtemp(join(tmpdir(), 'howcode-git-index-'))
  const env = { ...process.env, GIT_INDEX_FILE: join(tempDir, 'index') }

  try {
    const repositoryHasHead = await hasHeadCommit(directoryId)
    if (repositoryHasHead) {
      await runGitWithOptions(directoryId, ['read-tree', 'HEAD'], {
        env,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      })
    }

    return await callback({ env, hasHead: repositoryHasHead })
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
}
