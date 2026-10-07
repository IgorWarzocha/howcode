import { stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'

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

export function getProjectNativeSkillsDir(projectPath?: string | undefined | null | undefined) {
  if (!projectPath?.trim()) {
    return null
  }

  return path.join(path.resolve(projectPath), '.pi', 'skills')
}

export function getChatNativeSkillsDir() {
  return path.join(getDesktopUserDataPath(), 'chat', '.pi', 'skills')
}

export function getProjectInteropSkillsDir(projectPath?: string | undefined | null | undefined) {
  if (!projectPath?.trim()) {
    return null
  }

  return path.join(path.resolve(projectPath), '.agents', 'skills')
}

export function getChatInteropSkillsDir() {
  return path.join(getDesktopUserDataPath(), 'chat', '.agents', 'skills')
}

export function getGlobalSkillsDirs() {
  return [getGlobalNativeSkillsDir(), getGlobalInteropSkillsDir()]
}

export function getProjectSkillsDirs(projectPath?: string | undefined | null | undefined) {
  return [getProjectNativeSkillsDir(projectPath), getProjectInteropSkillsDir(projectPath)].filter(
    (skillsDirPath): skillsDirPath is string => Boolean(skillsDirPath),
  )
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

export function getActiveProjectSkillsRoot(projectPath?: string | undefined | null | undefined) {
  return loadAppSettings().useAgentsSkillsPaths
    ? getProjectInteropSkillsDir(projectPath)
    : getProjectNativeSkillsDir(projectPath)
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
