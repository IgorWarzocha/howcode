import path from 'node:path'
import { ensureDirectory } from '../../../desktop/chat-repository.ts'
import { emitDesktopEvent } from '../../../desktop/runtime/desktop-events.ts'
import {
  enrichDirectoriesWithResolvedIds,
  resolveDirectoryPathForComparison,
} from './actions/directory-paths.ts'
import { importDirectories } from './directory-import.ts'
import { listDirectories } from './state.ts'

let startupDirectoryMetadataRefresh: Promise<unknown> | null = null

export async function disposeCodingShell() {
  await startupDirectoryMetadataRefresh
  startupDirectoryMetadataRefresh = null
}

function getDirectoryNameQualifier(directoryId: string) {
  const parentName = path.basename(path.dirname(directoryId))
  return parentName || path.dirname(directoryId) || directoryId
}

function disambiguateDuplicateDirectoryNames<WorkingDirectory extends { id: string; name: string }>(
  directories: WorkingDirectory[],
) {
  const directoriesByName = new Map<string, WorkingDirectory[]>()
  for (const directory of directories) {
    const normalizedName = directory.name.trim().toLowerCase()
    directoriesByName.set(normalizedName, [
      ...(directoriesByName.get(normalizedName) ?? []),
      directory,
    ])
  }
  return directories.map((directory) => {
    const duplicates = directoriesByName.get(directory.name.trim().toLowerCase())
    return !duplicates || duplicates.length <= 1
      ? directory
      : { ...directory, name: `${directory.name} · ${getDirectoryNameQualifier(directory.id)}` }
  })
}

/** Coding owns directory discovery. Merely loading the chat shell must not start it. */
export async function loadCodingShell(cwd: string) {
  ensureDirectory(cwd)
  if (!startupDirectoryMetadataRefresh) {
    startupDirectoryMetadataRefresh = importDirectories([])
      .then(() => emitDesktopEvent({ type: 'shell-state-refresh' }))
      .catch((error) => {
        startupDirectoryMetadataRefresh = null
        console.warn('Failed to refresh project metadata.', error)
      })
  }
  const [resolvedCwd, directories] = await Promise.all([
    resolveDirectoryPathForComparison(cwd),
    enrichDirectoriesWithResolvedIds(listDirectories(cwd)),
  ])
  return {
    resolvedCwd,
    directories: disambiguateDuplicateDirectoryNames(
      directories.filter(
        (directory) => directory.id.trim().length > 0 && directory.name.trim().length > 0,
      ),
    ),
  }
}
