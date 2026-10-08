import { randomUUID } from 'node:crypto'
import { chmod, lstat, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import nodePath from 'node:path'
import type {
  DirectoryDiffFileContentIssue,
  DirectoryFileWriteRequest,
  DirectoryFileWriteResult,
} from '../../../../shared/desktop-contracts.ts'
import { runKeyedWorkspaceOperation } from '../keyed-workspace-operations.ts'
import {
  getDirectoryTextRevision,
  isContainedDirectoryPath,
  maxDirectoryDiffTextFileBytes,
  normalizeDirectoryPath,
} from './file-content.ts'

function unavailable(
  path: string,
  kind: DirectoryDiffFileContentIssue['kind'],
  details: Pick<DirectoryDiffFileContentIssue, 'size' | 'maxBytes'> = {},
): DirectoryFileWriteResult {
  return { kind: 'unavailable', issue: { kind, side: 'new', path, ...details } }
}

function conflict(
  request: DirectoryFileWriteRequest,
  path: string,
  currentRevision: string | null,
): DirectoryFileWriteResult {
  return {
    kind: 'conflict',
    path,
    expectedRevision: request.expectedRevision,
    currentRevision,
  }
}

async function readCurrentRevision(path: string) {
  try {
    return getDirectoryTextRevision(await readFile(path))
  } catch {
    return null
  }
}

async function writeDirectoryTextFileExclusive(
  request: DirectoryFileWriteRequest,
  directoryRoot: string,
  path: string,
): Promise<DirectoryFileWriteResult> {
  const candidatePath = nodePath.resolve(directoryRoot, path)
  if (!isContainedDirectoryPath(directoryRoot, candidatePath)) {
    return unavailable(path, 'invalid-path')
  }

  let parentPath: string
  try {
    parentPath = await realpath(nodePath.dirname(candidatePath))
  } catch {
    return conflict(request, path, null)
  }
  if (
    !isContainedDirectoryPath(directoryRoot, parentPath) &&
    nodePath.relative(directoryRoot, parentPath) !== ''
  ) {
    return unavailable(path, 'invalid-path')
  }
  if (nodePath.relative(parentPath, nodePath.dirname(candidatePath)) !== '') {
    return unavailable(path, 'invalid-path')
  }

  let currentStat: Awaited<ReturnType<typeof stat>>
  try {
    const candidateLinkStat = await lstat(candidatePath)
    if (candidateLinkStat.isSymbolicLink()) return unavailable(path, 'invalid-path')
    currentStat = await stat(candidatePath)
  } catch {
    return conflict(request, path, null)
  }
  if (!currentStat.isFile()) return unavailable(path, 'not-file')
  if (currentStat.size > maxDirectoryDiffTextFileBytes) {
    return unavailable(path, 'too-large', {
      size: currentStat.size,
      maxBytes: maxDirectoryDiffTextFileBytes,
    })
  }

  const currentRevision = await readCurrentRevision(candidatePath)
  if (currentRevision !== request.expectedRevision) {
    return conflict(request, path, currentRevision)
  }

  const nextContents = Buffer.from(request.contents, 'utf8')
  if (nextContents.includes(0)) return unavailable(path, 'binary')
  if (nextContents.byteLength > maxDirectoryDiffTextFileBytes) {
    return unavailable(path, 'too-large', {
      size: nextContents.byteLength,
      maxBytes: maxDirectoryDiffTextFileBytes,
    })
  }

  const temporaryPath = nodePath.join(
    parentPath,
    `.howcode-${nodePath.basename(path)}-${randomUUID()}.tmp`,
  )
  try {
    const temporaryFile = await open(temporaryPath, 'wx', currentStat.mode)
    try {
      await temporaryFile.writeFile(nextContents)
      await temporaryFile.sync()
    } finally {
      await temporaryFile.close()
    }
    await chmod(temporaryPath, currentStat.mode)

    const revisionBeforeRename = await readCurrentRevision(candidatePath)
    if (revisionBeforeRename !== request.expectedRevision) {
      return conflict(request, path, revisionBeforeRename)
    }

    await rename(temporaryPath, candidatePath)
    return {
      kind: 'written',
      file: {
        path,
        contents: request.contents,
        revision: getDirectoryTextRevision(nextContents),
      },
    }
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function writeDirectoryTextFile(
  request: DirectoryFileWriteRequest,
): Promise<DirectoryFileWriteResult> {
  const path = normalizeDirectoryPath(request.path)
  if (!path) return unavailable(request.path, 'invalid-path')

  let directoryRoot: string
  try {
    directoryRoot = await realpath(request.directoryId)
  } catch {
    return unavailable(path, 'missing')
  }

  return runKeyedWorkspaceOperation('file-write', `${directoryRoot}\0${path}`, () =>
    writeDirectoryTextFileExclusive(request, directoryRoot, path),
  )
}

export function getDirectoryFileWriteError(
  result: Exclude<DirectoryFileWriteResult, { kind: 'written' }>,
) {
  if (result.kind === 'conflict') {
    return `Could not save ${result.path} because it changed outside Howcode. The editor remains open.`
  }

  const { issue } = result
  switch (issue.kind) {
    case 'invalid-path':
      return `Could not save ${issue.path}: the project path is invalid.`
    case 'missing':
      return `Could not save ${issue.path}: the project file is missing.`
    case 'not-file':
      return `Could not save ${issue.path}: the project path is not a file.`
    case 'binary':
      return `Could not save ${issue.path}: binary contents are not supported.`
    case 'too-large':
      return `Could not save ${issue.path}: the file exceeds the editing size limit.`
    case 'changed':
      return `Could not save ${issue.path}: the file changed while it was being written.`
    default:
      return `Could not save ${issue.path}.`
  }
}
