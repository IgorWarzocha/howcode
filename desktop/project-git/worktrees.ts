import path from 'node:path'
import { formatGitCommandError, getNonInteractiveGitEnv, runGitWithOptions } from './git-runner.ts'

export type GitWorktreeEntry = {
  path: string
  head: string | null
  branch: string | null
  detached: boolean
}

export type GitWorktreeCreateResult =
  | { didMutate: true; projectId: string; rootProjectId: string; branchName: string }
  | { error: string }

function normalizeBranchRef(ref: string) {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
}

export function parseGitWorktreePorcelain(output: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = []
  let current: GitWorktreeEntry | null = null

  const finishCurrent = () => {
    if (!current) return
    entries.push(current)
    current = null
  }

  for (const line of output.split('\n')) {
    const trimmedLine = line.trimEnd()
    if (trimmedLine.length === 0) {
      finishCurrent()
      continue
    }

    const { key, value } = parsePorcelainLine(trimmedLine)
    if (key === 'worktree') {
      finishCurrent()
      current = { path: value, head: null, branch: null, detached: false }
      continue
    }

    if (!current) continue
    applyPorcelainField(current, key, value)
  }

  finishCurrent()
  return entries
}

function parsePorcelainLine(line: string) {
  const [key, ...valueParts] = line.split(' ')
  return { key, value: valueParts.join(' ') }
}

function applyPorcelainField(entry: GitWorktreeEntry, key: string | undefined, value: string) {
  if (key === 'HEAD') entry.head = value || null
  if (key === 'branch') entry.branch = value ? normalizeBranchRef(value) : null
  if (key === 'detached') entry.detached = true
}

function sanitizeWorktreeFolderName(branchName: string) {
  return branchName
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, '-')
    .replaceAll(/[\s.]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

async function resolveMainWorktree(projectId: string) {
  const { stdout } = await runGitWithOptions(projectId, ['worktree', 'list', '--porcelain'], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
  const worktrees = parseGitWorktreePorcelain(stdout)
  return worktrees[0] ?? null
}

export async function getMainWorktreePath(projectId: string) {
  return (await resolveMainWorktree(projectId))?.path ?? projectId
}

async function hasLocalBranch(projectId: string, branchName: string) {
  try {
    await runGitWithOptions(projectId, ['show-ref', '--verify', `refs/heads/${branchName}`], {
      timeout: 10_000,
      maxBuffer: 1024 * 128,
    })
    return true
  } catch {
    return false
  }
}

export async function loadGitWorktrees(projectId: string) {
  const { stdout } = await runGitWithOptions(projectId, ['worktree', 'list', '--porcelain'], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
  return parseGitWorktreePorcelain(stdout)
}

function resolveWorktreeParent(rootProjectId: string, worktreeDirectory: string) {
  return path.isAbsolute(worktreeDirectory)
    ? path.resolve(worktreeDirectory)
    : path.resolve(rootProjectId, worktreeDirectory)
}

export async function createProjectWorktree(input: {
  projectId: string
  branchName: string
  worktreeDirectory: string
}): Promise<GitWorktreeCreateResult> {
  const branchName = input.branchName.trim()
  if (!branchName) return { error: 'Branch name is required.' }

  const folderName = sanitizeWorktreeFolderName(branchName)
  if (!folderName) return { error: 'Branch name cannot be used as a worktree folder.' }

  try {
    const mainWorktree = await resolveMainWorktree(input.projectId)
    const rootProjectId = mainWorktree?.path ?? input.projectId
    const worktreePath = path.join(
      resolveWorktreeParent(rootProjectId, input.worktreeDirectory),
      folderName,
    )

    await runGitWithOptions(input.projectId, ['check-ref-format', '--branch', branchName], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })

    const worktreeAddArgs = (await hasLocalBranch(input.projectId, branchName))
      ? ['worktree', 'add', worktreePath, branchName]
      : ['worktree', 'add', '-b', branchName, worktreePath]

    await runGitWithOptions(input.projectId, worktreeAddArgs, {
      env: getNonInteractiveGitEnv(),
      timeout: 30_000,
      maxBuffer: 1024 * 1024 * 4,
    })

    return { didMutate: true, projectId: worktreePath, rootProjectId, branchName }
  } catch (error) {
    return { error: formatGitCommandError(error) }
  }
}
