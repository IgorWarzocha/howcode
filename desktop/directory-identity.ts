import { realpath } from 'node:fs/promises'
import path from 'node:path'

function normalizePlatformPath(directoryPath: string) {
  return process.platform === 'win32' ? directoryPath.toLowerCase() : directoryPath
}

export async function resolveDirectoryIdentity(directoryId: string) {
  const resolvedDirectoryId = path.resolve(directoryId)
  try {
    return normalizePlatformPath(await realpath(resolvedDirectoryId))
  } catch {
    return normalizePlatformPath(resolvedDirectoryId)
  }
}

export async function indexByDirectoryIdentity<T>(values: T[], getPath: (value: T) => string) {
  return new Map(
    await Promise.all(
      values.map(async (value) => [await resolveDirectoryIdentity(getPath(value)), value] as const),
    ),
  )
}
