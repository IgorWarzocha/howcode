import { realpath } from 'node:fs/promises'
import path from 'node:path'

function normalizePlatformPath(projectPath: string) {
  return process.platform === 'win32' ? projectPath.toLowerCase() : projectPath
}

export async function resolveWorkspaceIdentity(projectId: string) {
  const resolvedProjectId = path.resolve(projectId)
  try {
    return normalizePlatformPath(await realpath(resolvedProjectId))
  } catch {
    return normalizePlatformPath(resolvedProjectId)
  }
}

export async function indexByWorkspaceIdentity<T>(values: T[], getPath: (value: T) => string) {
  return new Map(
    await Promise.all(
      values.map(async (value) => [await resolveWorkspaceIdentity(getPath(value)), value] as const),
    ),
  )
}
