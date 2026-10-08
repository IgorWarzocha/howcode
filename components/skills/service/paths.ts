import { stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAppSettings } from '../../../desktop/app-settings/readers.ts'
import { getAgentDirectory } from '../../../desktop/settings/paths.ts'
import { getDesktopUserDataPath } from '../../../desktop/user-data-path.ts'

export async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    )
      return false
    throw error
  }
}

export function getGlobalNativeSkillsDir() {
  return path.join(getAgentDirectory(), 'skills')
}

export function getGlobalInteropSkillsDir() {
  return path.join(os.homedir(), '.agents', 'skills')
}

export function getDirectoryNativeSkillsDir(directoryPath?: string | undefined | null | undefined) {
  if (!directoryPath?.trim()) {
    return null
  }

  return path.join(path.resolve(directoryPath), '.pi', 'skills')
}

export function getChatNativeSkillsDir() {
  return path.join(getDesktopUserDataPath(), 'chat', '.pi', 'skills')
}

export function getDirectoryInteropSkillsDir(
  directoryPath?: string | undefined | null | undefined,
) {
  if (!directoryPath?.trim()) {
    return null
  }

  return path.join(path.resolve(directoryPath), '.agents', 'skills')
}

export function getChatInteropSkillsDir() {
  return path.join(getDesktopUserDataPath(), 'chat', '.agents', 'skills')
}

export function getGlobalSkillsDirs() {
  return [getGlobalNativeSkillsDir(), getGlobalInteropSkillsDir()]
}

export function getDirectorySkillsDirs(directoryPath?: string | undefined | null | undefined) {
  return [
    getDirectoryNativeSkillsDir(directoryPath),
    getDirectoryInteropSkillsDir(directoryPath),
  ].filter((skillsDirPath): skillsDirPath is string => Boolean(skillsDirPath))
}

export function getChatSkillsDirs() {
  return [getChatNativeSkillsDir(), getChatInteropSkillsDir()].filter(
    (skillsDirPath): skillsDirPath is string => Boolean(skillsDirPath),
  )
}

export function getActiveGlobalSkillsRoot() {
  return loadAppSettings().useAgentsSkillsPaths
    ? getGlobalInteropSkillsDir()
    : getGlobalNativeSkillsDir()
}

export function getActiveDirectorySkillsRoot(
  directoryPath?: string | undefined | null | undefined,
) {
  return loadAppSettings().useAgentsSkillsPaths
    ? getDirectoryInteropSkillsDir(directoryPath)
    : getDirectoryNativeSkillsDir(directoryPath)
}

export function getActiveChatSkillsRoot() {
  return loadAppSettings().useAgentsSkillsPaths
    ? getChatInteropSkillsDir()
    : getChatNativeSkillsDir()
}

export function isValidSkillSlug(slug: string) {
  const trimmedSlug = slug.trim()

  return (
    trimmedSlug.length > 0 &&
    trimmedSlug !== '.' &&
    trimmedSlug !== '..' &&
    !trimmedSlug.includes('/') &&
    !trimmedSlug.includes('\\')
  )
}

export function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath)
  return (
    relativePath.length === 0 || !(relativePath.startsWith('..') || path.isAbsolute(relativePath))
  )
}

export function isPathWithinRootDescendant(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}
