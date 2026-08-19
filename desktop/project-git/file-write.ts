import { randomUUID } from 'node:crypto'
import { chmod, lstat, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import nodePath from 'node:path'
import type {
  ProjectDiffFileContentIssue,
  ProjectFileWriteRequest,
  ProjectFileWriteResult,
} from '../../shared/desktop-contracts.ts'
import {
  getProjectTextRevision,
  isContainedProjectPath,
  maxProjectDiffTextFileBytes,
  normalizeProjectPath,
} from './file-content.ts'

const activeFileWrites = new Map<string, Promise<void>>()

function unavailable(
  path: string,
  kind: ProjectDiffFileContentIssue['kind'],
  details: Pick<ProjectDiffFileContentIssue, 'size' | 'maxBytes'> = {},
): ProjectFileWriteResult {
  return { kind: 'unavailable', issue: { kind, side: 'new', path, ...details } }
}

function conflict(
  request: ProjectFileWriteRequest,
  path: string,
  currentRevision: string | null,
): ProjectFileWriteResult {
  return {
    kind: 'conflict',
    path,
    expectedRevision: request.expectedRevision,
    currentRevision,
  }
}

async function runExclusiveFileWrite<T>(key: string, task: () => Promise<T>) {
  const previous = activeFileWrites.get(key) ?? Promise.resolve()
  const next = previous.then(task, task)
  let tail: Promise<void>
  const clearQueue = () => {
    if (activeFileWrites.get(key) === tail) activeFileWrites.delete(key)
  }
  tail = next.then(clearQueue, clearQueue)
  activeFileWrites.set(key, tail)
  return next
}

async function readCurrentRevision(path: string) {
  try {
    return getProjectTextRevision(await readFile(path))
  } catch {
    return null
  }
}

async function writeProjectTextFileExclusive(
  request: ProjectFileWriteRequest,
  projectRoot: string,
  path: string,
): Promise<ProjectFileWriteResult> {
  const candidatePath = nodePath.resolve(projectRoot, path)
  if (!isContainedProjectPath(projectRoot, candidatePath)) {
    return unavailable(path, 'invalid-path')
  }

  let parentPath: string
  try {
    parentPath = await realpath(nodePath.dirname(candidatePath))
  } catch {
    return conflict(request, path, null)
  }
  if (
    !isContainedProjectPath(projectRoot, parentPath) &&
    nodePath.relative(projectRoot, parentPath) !== ''
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
  if (currentStat.size > maxProjectDiffTextFileBytes) {
    return unavailable(path, 'too-large', {
      size: currentStat.size,
      maxBytes: maxProjectDiffTextFileBytes,
    })
  }

  const currentRevision = await readCurrentRevision(candidatePath)
  if (currentRevision !== request.expectedRevision) {
    return conflict(request, path, currentRevision)
  }

  const nextContents = Buffer.from(request.contents, 'utf8')
  if (nextContents.includes(0)) return unavailable(path, 'binary')
  if (nextContents.byteLength > maxProjectDiffTextFileBytes) {
    return unavailable(path, 'too-large', {
      size: nextContents.byteLength,
      maxBytes: maxProjectDiffTextFileBytes,
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
        revision: getProjectTextRevision(nextContents),
      },
    }
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function writeProjectTextFile(
  request: ProjectFileWriteRequest,
): Promise<ProjectFileWriteResult> {
  const path = normalizeProjectPath(request.path)
  if (!path) return unavailable(request.path, 'invalid-path')

  let projectRoot: string
  try {
    projectRoot = await realpath(request.projectId)
  } catch {
    return unavailable(path, 'missing')
  }

  return runExclusiveFileWrite(`${projectRoot}\0${path}`, () =>
    writeProjectTextFileExclusive(request, projectRoot, path),
  )
}

export function getProjectFileWriteError(
  result: Exclude<ProjectFileWriteResult, { kind: 'written' }>,
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
