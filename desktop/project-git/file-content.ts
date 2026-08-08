import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import nodePath from 'node:path'
import type {
  ProjectDiffFileContentIssue,
  ProjectDiffFileContentsRequest,
  ProjectDiffFileContentsResult,
  ProjectDiffTextFile,
} from '../../shared/desktop-contracts.ts'
import { runGitBufferWithOptions, runGitWithOptions } from './git-runner.ts'
import { isGitRepository } from './project-state.ts'

export const maxProjectDiffTextFileBytes = 4 * 1024 * 1024
const windowsAbsolutePathPattern = /^[a-zA-Z]:\//

type FileSide = ProjectDiffFileContentIssue['side']
type UnavailableReadResult = { kind: 'unavailable'; issue: ProjectDiffFileContentIssue }
type ReadResult = { kind: 'ready'; file: ProjectDiffTextFile } | UnavailableReadResult

function unavailable(
  side: FileSide,
  path: string,
  kind: ProjectDiffFileContentIssue['kind'],
  details: Pick<ProjectDiffFileContentIssue, 'size' | 'maxBytes'> = {},
): UnavailableReadResult {
  return { kind: 'unavailable', issue: { kind, side, path, ...details } }
}

function normalizeProjectPath(path: string) {
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

function isContainedPath(root: string, candidate: string) {
  const relative = nodePath.relative(root, candidate)
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${nodePath.sep}`) &&
    !nodePath.isAbsolute(relative)
  )
}

function getRevision(contents: Buffer) {
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
        revision: getRevision(contents),
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

async function readWorktreeTextFile(projectRoot: string, path: string): Promise<ReadResult> {
  const normalizedPath = normalizeProjectPath(path)
  if (!normalizedPath) return unavailable('new', path, 'invalid-path')

  const unresolvedPath = nodePath.resolve(projectRoot, normalizedPath)
  if (!isContainedPath(projectRoot, unresolvedPath)) {
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
  if (!isContainedPath(projectRoot, resolvedPath)) {
    return unavailable('new', normalizedPath, 'invalid-path')
  }

  let before: Awaited<ReturnType<typeof stat>>
  try {
    before = await stat(resolvedPath)
  } catch {
    return unavailable('new', normalizedPath, 'missing')
  }
  if (!before.isFile()) return unavailable('new', normalizedPath, 'not-file')
  if (before.size > maxProjectDiffTextFileBytes) {
    return unavailable('new', normalizedPath, 'too-large', {
      size: before.size,
      maxBytes: maxProjectDiffTextFileBytes,
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
  projectId: string,
  baselineRevision: string,
  path: string,
): Promise<ReadResult> {
  const normalizedPath = normalizeProjectPath(path)
  if (!normalizedPath) return unavailable('old', path, 'invalid-path')

  const objectSpec = `${baselineRevision}:${normalizedPath}`
  let size: number
  try {
    const result = await runGitWithOptions(projectId, ['cat-file', '-s', objectSpec], {
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
  if (size > maxProjectDiffTextFileBytes) {
    return unavailable('old', normalizedPath, 'too-large', {
      size,
      maxBytes: maxProjectDiffTextFileBytes,
    })
  }

  try {
    const { stdout } = await runGitBufferWithOptions(projectId, ['show', objectSpec], {
      timeout: 10_000,
      maxBuffer: maxProjectDiffTextFileBytes + 1024,
    })
    return decodeText(stdout, 'old', normalizedPath)
  } catch {
    return unavailable('old', normalizedPath, 'missing')
  }
}

export async function loadProjectDiffFileContents(
  request: ProjectDiffFileContentsRequest,
): Promise<ProjectDiffFileContentsResult> {
  if (!(await isGitRepository(request.projectId))) {
    return unavailable('new', request.newPath, 'missing')
  }

  let projectRoot: string
  try {
    projectRoot = await realpath(request.projectId)
  } catch {
    return unavailable('new', request.newPath, 'missing')
  }

  const [oldResult, newResult] = await Promise.all([
    request.oldPath
      ? readBaselineTextFile(request.projectId, request.baselineRevision, request.oldPath)
      : null,
    readWorktreeTextFile(projectRoot, request.newPath),
  ])
  if (oldResult?.kind === 'unavailable') return oldResult
  if (newResult.kind === 'unavailable') return newResult

  return {
    kind: 'ready',
    oldFile: oldResult?.file ?? null,
    newFile: newResult.file,
  }
}
