import { access } from 'node:fs/promises'
import path from 'node:path'
import { formatGitCommandError, getNonInteractiveGitEnv, runGitWithOptions } from './git-runner.ts'

export type GitWorktreeEntry = {
  path: string
  head: string | null
  branch: string | null
  detached: boolean
  prunable: boolean
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
      current = { path: value, head: null, branch: null, detached: false, prunable: false }
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
  if (key === 'prunable') entry.prunable = true
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

async function findRemoteBranchBase(projectId: string, branchName: string) {
  try {
    const { stdout } = await runGitWithOptions(
      projectId,
      ['for-each-ref', '--format=%(refname:short)', 'refs/remotes'],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 512,
      },
    )
    const remoteBranches = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.endsWith('/HEAD'))
    return (
      remoteBranches.find((remoteBranch) => remoteBranch === `origin/${branchName}`) ??
      remoteBranches.find((remoteBranch) => remoteBranch.endsWith(`/${branchName}`)) ??
      null
    )
  } catch {
    return null
  }
}

async function pathExists(candidatePath: string) {
  try {
    await access(candidatePath)
    return true
  } catch {
    return false
  }
}

async function resolveAvailableWorktreePath(parentPath: string, folderName: string) {
  const initialPath = path.join(parentPath, folderName)
  if (!(await pathExists(initialPath))) return initialPath

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidatePath = path.join(parentPath, `${folderName}-${suffix}`)
    if (!(await pathExists(candidatePath))) return candidatePath
  }

  throw new Error('Could not find an available worktree folder name.')
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
    const worktreePath = await resolveAvailableWorktreePath(
      resolveWorktreeParent(rootProjectId, input.worktreeDirectory),
      folderName,
    )

    await runGitWithOptions(input.projectId, ['check-ref-format', '--branch', branchName], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })

    const localBranchExists = await hasLocalBranch(input.projectId, branchName)
    const remoteBranchBase = localBranchExists
      ? null
      : await findRemoteBranchBase(input.projectId, branchName)
    const worktreeAddArgs = localBranchExists
      ? ['worktree', 'add', worktreePath, branchName]
      : remoteBranchBase
        ? ['worktree', 'add', '-b', branchName, worktreePath, remoteBranchBase]
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

export async function removeProjectWorktree(projectId: string, worktreePath: string) {
  const normalizedPath = worktreePath.trim()
  if (!normalizedPath) return { error: 'Worktree path is required.' }

  try {
    const worktrees = await loadGitWorktrees(projectId)
    const worktree = worktrees.find(
      (entry) => path.resolve(entry.path) === path.resolve(normalizedPath),
    )
    if (!worktree) return { error: 'Worktree is not registered with Git.' }
    if (worktree.path === (worktrees[0]?.path ?? null)) {
      return { error: 'Cannot remove the main worktree.' }
    }

    await runGitWithOptions(projectId, ['worktree', 'remove', worktree.path], {
      env: getNonInteractiveGitEnv(),
      timeout: 30_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return {
      didMutate: true,
      projectId: worktree.path,
      rootProjectId: worktrees[0]?.path ?? projectId,
    }
  } catch (error) {
    return { error: formatGitCommandError(error) }
  }
}
