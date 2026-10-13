import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { createNativeGitReader } from '@howaboua/pi-durable-git/native'

const execFile = promisify(execFileCallback)
const reader = createNativeGitReader()
export const isGitRepository = (id: string) => reader.isRepository(id)

/** Folder add/clone lifecycle works independently of optional GitOps and Sidebar. */
export function getNonInteractiveGitEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key]
  return {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
    GIT_ASKPASS: 'echo',
    SSH_ASKPASS: 'echo',
    GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oConnectTimeout=5',
  }
}
export async function initializeDirectoryGit(id: string) {
  if (await isGitRepository(id)) return
  await execFile('git', ['init'], { cwd: id, env: getNonInteractiveGitEnv(), timeout: 3_000 })
}
export async function getOriginUrl(id: string) {
  try {
    const { stdout } = await execFile('git', ['remote', 'get-url', 'origin'], {
      cwd: id,
      env: getNonInteractiveGitEnv(),
      timeout: 3_000,
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}
export function formatGitCommandError(error: unknown) {
  if (!(error instanceof Error)) return 'Git command failed.'
  const output = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : ''
  return (output || error.message).replace(/\s+/g, ' ').trim() || 'Git command failed.'
}
