import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import nodePath from 'node:path'
import type {
  DirectoryDiffFileContentIssue,
  DirectoryDiffFileContentsRequest,
  DirectoryDiffFileContentsResult,
  DirectoryDiffTextFile,
} from '../../../../shared/desktop-contracts.ts'
import { isGitRepository } from './directory-state.ts'
import { runGitBufferWithOptions, runGitWithOptions } from './git-runner.ts'

export const maxDirectoryDiffTextFileBytes = 4 * 1024 * 1024
const windowsAbsolutePathPattern = /^[a-zA-Z]:\//

type FileSide = DirectoryDiffFileContentIssue['side']
type UnavailableReadResult = { kind: 'unavailable'; issue: DirectoryDiffFileContentIssue }
type ReadResult = { kind: 'ready'; file: DirectoryDiffTextFile } | UnavailableReadResult

function unavailable(
  side: FileSide,
  path: string,
  kind: DirectoryDiffFileContentIssue['kind'],
  details: Pick<DirectoryDiffFileContentIssue, 'size' | 'maxBytes'> = {},
): UnavailableReadResult {
  return { kind: 'unavailable', issue: { kind, side, path, ...details } }
}

export function normalizeDirectoryPath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  if (
    normalized.length === 0 ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    windowsAbsolutePathPattern.test(normalized)
  ) {
    return null
  }

  const segments = normalized.split('/')
  return segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    ? null
    : segments.join('/')
}

export function isContainedDirectoryPath(root: string, candidate: string) {
  const relative = nodePath.relative(root, candidate)
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${nodePath.sep}`) &&
    !nodePath.isAbsolute(relative)
  )
}

export function getDirectoryTextRevision(contents: Buffer) {
  return `sha256:${createHash('sha256').update(contents).digest('hex')}`
}

function decodeText(contents: Buffer, side: FileSide, path: string): ReadResult {
  if (contents.includes(0)) return unavailable(side, path, 'binary')
  try {
    return {
      kind: 'ready',
      file: {
        path,
        contents: new TextDecoder('utf-8', { fatal: true }).decode(contents),
        revision: getDirectoryTextRevision(contents),
      },
    }
  } catch {
    return unavailable(side, path, 'binary')
  }
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}

async function readWorktreeTextFile(directoryRoot: string, path: string): Promise<ReadResult> {
  const normalizedPath = normalizeDirectoryPath(path)
  if (!normalizedPath) return unavailable('new', path, 'invalid-path')

  const unresolvedPath = nodePath.resolve(directoryRoot, normalizedPath)
  if (!isContainedDirectoryPath(directoryRoot, unresolvedPath)) {
    return unavailable('new', normalizedPath, 'invalid-path')
  }

  let resolvedPath: string
  try {
    resolvedPath = await realpath(unresolvedPath)
  } catch (error) {
    return isMissingFileError(error)
      ? unavailable('new', normalizedPath, 'missing')
      : unavailable('new', normalizedPath, 'invalid-path')
  }
  if (!isContainedDirectoryPath(directoryRoot, resolvedPath)) {
    return unavailable('new', normalizedPath, 'invalid-path')
  }

  let before: Awaited<ReturnType<typeof stat>>
  try {
    before = await stat(resolvedPath)
  } catch {
    return unavailable('new', normalizedPath, 'missing')
  }
  if (!before.isFile()) return unavailable('new', normalizedPath, 'not-file')
  if (before.size > maxDirectoryDiffTextFileBytes) {
    return unavailable('new', normalizedPath, 'too-large', {
      size: before.size,
      maxBytes: maxDirectoryDiffTextFileBytes,
    })
  }

  let contents: Buffer
  let after: Awaited<ReturnType<typeof stat>>
  try {
    contents = await readFile(resolvedPath)
    after = await stat(resolvedPath)
  } catch {
    return unavailable('new', normalizedPath, 'changed')
  }
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    return unavailable('new', normalizedPath, 'changed')
  }
  return decodeText(contents, 'new', normalizedPath)
}

async function readBaselineTextFile(
  directoryId: string,
  baselineRevision: string,
  path: string,
): Promise<ReadResult> {
  const normalizedPath = normalizeDirectoryPath(path)
  if (!normalizedPath) return unavailable('old', path, 'invalid-path')

  const objectSpec = `${baselineRevision}:${normalizedPath}`
  let size: number
  try {
    const result = await runGitWithOptions(directoryId, ['cat-file', '-s', objectSpec], {
      timeout: 10_000,
      maxBuffer: 1024 * 64,
    })
    size = Number.parseInt(result.stdout.trim(), 10)
  } catch {
    return unavailable('old', normalizedPath, 'missing')
  }
  if (!Number.isSafeInteger(size) || size < 0) {
    return unavailable('old', normalizedPath, 'missing')
  }
  if (size > maxDirectoryDiffTextFileBytes) {
    return unavailable('old', normalizedPath, 'too-large', {
      size,
      maxBytes: maxDirectoryDiffTextFileBytes,
    })
  }

  try {
    const { stdout } = await runGitBufferWithOptions(directoryId, ['show', objectSpec], {
      timeout: 10_000,
      maxBuffer: maxDirectoryDiffTextFileBytes + 1024,
    })
    return decodeText(stdout, 'old', normalizedPath)
  } catch {
    return unavailable('old', normalizedPath, 'missing')
  }
}

export async function loadDirectoryDiffFileContents(
  request: DirectoryDiffFileContentsRequest,
): Promise<DirectoryDiffFileContentsResult> {
  if (!(await isGitRepository(request.directoryId))) {
    return unavailable('new', request.newPath, 'missing')
  }

  let directoryRoot: string
  try {
    directoryRoot = await realpath(request.directoryId)
  } catch {
    return unavailable('new', request.newPath, 'missing')
  }

  const [oldResult, newResult] = await Promise.all([
    request.oldPath
      ? readBaselineTextFile(request.directoryId, request.baselineRevision, request.oldPath)
      : null,
    readWorktreeTextFile(directoryRoot, request.newPath),
  ])
  if (oldResult?.kind === 'unavailable') return oldResult
  if (newResult.kind === 'unavailable') return newResult

  return {
    kind: 'ready',
    oldFile: oldResult?.file ?? null,
    newFile: newResult.file,
  }
}
