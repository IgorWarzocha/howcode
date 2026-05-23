import { execFile as execFileCallback, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

export async function runGit(projectId: string, args: string[]) {
  return runGitWithOptions(projectId, args)
}

export async function runGitWithOptions(
  projectId: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv
    maxBuffer?: number | undefined
    timeout?: number | undefined
  } = {},
) {
  return execFile('git', args, {
    cwd: projectId,
    env: options.env,
    timeout: options.timeout ?? 3_000,
    maxBuffer: options.maxBuffer ?? 1024 * 128,
  })
}

export function runGitBufferWithOptions(
  projectId: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv
    maxBuffer?: number | undefined
    timeout?: number | undefined
  } = {},
) {
  return new Promise<{ stdout: Buffer; stderr: Buffer }>((resolve, reject) => {
    execFileCallback(
      'git',
      args,
      {
        cwd: projectId,
        encoding: 'buffer',
        env: options.env,
        timeout: options.timeout ?? 3_000,
        maxBuffer: options.maxBuffer ?? 1024 * 128,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }))
          return
        }

        resolve({ stdout, stderr })
      },
    )
  })
}

export type GitStreamingProcess = {
  promise: Promise<{ stdout: string; stderr: string }>
  cancel: () => void
}

export function startGitStreamingWithOptions(
  projectId: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv
    timeout?: number | undefined
    maxAccumulatedStdoutBytes?: number | undefined
    maxAccumulatedStderrBytes?: number | undefined
    signal?: AbortSignal | undefined
    onStdoutChunk: (chunk: string) => void
  },
): GitStreamingProcess {
  let cancel: () => void = () => undefined
  const promise = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: projectId,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let stdoutBytes = 0
    let stderrBytes = 0
    let settled = false
    const maxAccumulatedStdoutBytes = options.maxAccumulatedStdoutBytes ?? 64 * 1024 * 1024
    const maxAccumulatedStderrBytes = options.maxAccumulatedStderrBytes ?? 1024 * 1024
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      rejectOnce(new Error(`Git command timed out after ${options.timeout ?? 3_000}ms.`))
    }, options.timeout ?? 3_000)

    const cleanupAbortListener = () => {
      options.signal?.removeEventListener('abort', abortListener)
    }

    const rejectOnce = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      cleanupAbortListener()
      reject(Object.assign(error, { stdout, stderr }))
    }

    const abortListener = () => {
      child.kill('SIGTERM')
      rejectOnce(new Error('Git command cancelled.'))
    }

    if (options.signal?.aborted) {
      abortListener()
      return
    }

    options.signal?.addEventListener('abort', abortListener, { once: true })

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk, 'utf8')
      if (stdoutBytes > maxAccumulatedStdoutBytes) {
        child.kill('SIGTERM')
        rejectOnce(new Error('Git command produced too much stdout.'))
        return
      }
      stdout += chunk
      options.onStdoutChunk(chunk)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderrBytes += Buffer.byteLength(chunk, 'utf8')
      stderr += chunk
      if (stderrBytes > maxAccumulatedStderrBytes) {
        stderr = stderr.slice(-maxAccumulatedStderrBytes)
        stderrBytes = Buffer.byteLength(stderr, 'utf8')
      }
    })
    cancel = () => {
      if (settled) return
      child.kill('SIGTERM')
      rejectOnce(new Error('Git command cancelled.'))
    }
    child.on('error', rejectOnce)
    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      cleanupAbortListener()
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      reject(
        Object.assign(new Error(`Git command failed with ${signal ?? `exit code ${code}`}.`), {
          stdout,
          stderr,
        }),
      )
    })
  })

  return { promise, cancel }
}

export function runGitStreamingWithOptions(
  projectId: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv
    timeout?: number | undefined
    maxAccumulatedStdoutBytes?: number | undefined
    maxAccumulatedStderrBytes?: number | undefined
    signal?: AbortSignal | undefined
    onStdoutChunk: (chunk: string) => void
  },
) {
  return startGitStreamingWithOptions(projectId, args, options).promise
}

export function getNonInteractiveGitEnv(baseEnv?: NodeJS.ProcessEnv) {
  return {
    ...process.env,
    ...baseEnv,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
    GIT_ASKPASS: 'echo',
    SSH_ASKPASS: 'echo',
    GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oConnectTimeout=5',
  }
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

export async function hasHeadCommit(projectId: string) {
  try {
    await runGit(projectId, ['rev-parse', '--verify', 'HEAD'])
    return true
  } catch {
    return false
  }
}

export async function withTemporaryIndex<T>(
  projectId: string,
  callback: (context: { env: NodeJS.ProcessEnv; hasHead: boolean }) => Promise<T>,
) {
  const tempDir = await mkdtemp(join(tmpdir(), 'howcode-git-index-'))
  const env = { ...process.env, GIT_INDEX_FILE: join(tempDir, 'index') }

  try {
    const repositoryHasHead = await hasHeadCommit(projectId)
    if (repositoryHasHead) {
      await runGitWithOptions(projectId, ['read-tree', 'HEAD'], {
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
