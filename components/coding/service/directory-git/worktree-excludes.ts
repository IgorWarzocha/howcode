import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runGitWithOptions } from './git-runner.ts'

const howcodeWorktreeMarkerPrefix = '# howcode worktree: '

async function readOptionalFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
}

function escapeGitignoreLiteral(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('*', '\\*')
    .replaceAll('?', '\\?')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll(' ', '\\ ')
}

function getOwnedExcludeEntry(relativeWorktreePath: string) {
  const normalizedPath = relativeWorktreePath.split(path.sep).join('/')
  const pattern = `/${escapeGitignoreLiteral(normalizedPath)}/`
  return { marker: `${howcodeWorktreeMarkerPrefix}${pattern}`, pattern }
}

async function getExcludePath(rootDirectoryId: string) {
  const { stdout } = await runGitWithOptions(
    rootDirectoryId,
    ['rev-parse', '--git-path', 'info/exclude'],
    { timeout: 10_000, maxBuffer: 1024 * 128 },
  )
  const rawExcludePath = stdout.trim()
  if (!rawExcludePath) return null
  return path.isAbsolute(rawExcludePath)
    ? rawExcludePath
    : path.resolve(rootDirectoryId, rawExcludePath)
}

export function getInRepositoryWorktreePath(rootDirectoryId: string, worktreePath: string) {
  const relativePath = path.relative(path.resolve(rootDirectoryId), path.resolve(worktreePath))
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return null
  }
  if (relativePath.includes('\n') || relativePath.includes('\r')) {
    throw new Error('In-repository worktree paths cannot contain line breaks.')
  }
  return relativePath
}

export async function ensureWorktreePathIgnored(
  rootDirectoryId: string,
  relativeWorktreePath: string | null,
) {
  if (!relativeWorktreePath) return

  const excludePath = await getExcludePath(rootDirectoryId)
  if (!excludePath) return
  const entry = getOwnedExcludeEntry(relativeWorktreePath)
  const existing = await readOptionalFile(excludePath)
  const lines = existing.split('\n')
  if (lines.some((line) => line.trim() === entry.pattern)) return

  await mkdir(path.dirname(excludePath), { recursive: true })
  await appendFile(
    excludePath,
    `${existing && !existing.endsWith('\n') ? '\n' : ''}${entry.marker}\n${entry.pattern}\n`,
  )
}

export async function removeOwnedWorktreePathIgnore(
  rootDirectoryId: string,
  relativeWorktreePath: string | null,
) {
  if (!relativeWorktreePath) return

  const excludePath = await getExcludePath(rootDirectoryId)
  if (!excludePath) return
  const existing = await readOptionalFile(excludePath)
  if (!existing) return

  const entry = getOwnedExcludeEntry(relativeWorktreePath)
  const lines = existing.split('\n')
  const nextLines: string[] = []
  let removed = false
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === entry.marker && lines[index + 1] === entry.pattern) {
      removed = true
      index += 1
      continue
    }
    nextLines.push(lines[index] ?? '')
  }

  if (removed) await writeFile(excludePath, nextLines.join('\n'))
}
