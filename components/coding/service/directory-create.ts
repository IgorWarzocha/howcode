import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { ensureDirectory } from '../../../desktop/chat-repository.ts'
import { startNewChat } from '../../../desktop/conversation-runtime.ts'
import { resolveDirectoryIdentity } from '../../../desktop/directory-identity.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import {
  isSameGitHubRepository,
  parseGitHubRepositoryUrl,
} from '../../../shared/github-repository-url.ts'
import { getOriginUrl, isGitRepository } from './directory-git/directory-state.ts'
import { formatGitCommandError, getNonInteractiveGitEnv } from './directory-git/git-runner.ts'
import { captureGitRepositoryIdentity } from './directory-git/repository-identity.ts'
import { getMainWorktreePath, initializeDirectoryGit } from './directory-git.ts'
import { listDirectories, setDirectoryRepoOrigin, upsertDirectoryWorktree } from './state.ts'

const execFile = promisify(execFileCallback)

function expandHomePath(directoryPath: string) {
  if (directoryPath === '~') return homedir()
  if (directoryPath.startsWith('~/') || directoryPath.startsWith('~\\')) {
    return path.join(homedir(), directoryPath.slice(2))
  }
  return directoryPath
}

async function startChatForNewlyVisibleDirectory(directoryId: string) {
  const result = await startNewChat({ directoryId })
  ensureDirectory(directoryId)
  await recordRootGitProvenance(directoryId)
  return result
}

async function recordRootGitProvenance(directoryId: string) {
  const repositoryIdentity = await captureGitRepositoryIdentity(directoryId)
  if (!repositoryIdentity) return

  const [directoryIdentity, mainWorktreePath] = await Promise.all([
    resolveDirectoryIdentity(directoryId),
    getMainWorktreePath(directoryId).catch(() => null),
  ])
  if (!mainWorktreePath) return

  const mainWorktreeIdentity = await resolveDirectoryIdentity(mainWorktreePath)
  if (
    directoryIdentity !== mainWorktreeIdentity ||
    repositoryIdentity.topLevelIdentity !== mainWorktreeIdentity
  ) {
    return
  }

  upsertDirectoryWorktree({
    cwd: directoryId,
    rootCwd: directoryId,
    branchName: null,
    gitCommonDirectoryIdentity: repositoryIdentity.commonDirectoryIdentity,
    isMain: true,
    source: 'howcode',
  })
}

function sanitizeDirectoryFolderName(directoryName: string) {
  let nextName = directoryName
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')

  nextName = Array.from(nextName, (char) => {
    const code = char.charCodeAt(0)
    return code >= 0 && code <= 31 ? '-' : char
  }).join('')

  return nextName
}

export async function createDirectory(options: {
  preferredDirectoryLocation: string | null
  directoryName: string
  initializeGit: boolean
}) {
  const preferredDirectoryLocation = options.preferredDirectoryLocation?.trim() ?? ''
  if (preferredDirectoryLocation.length === 0) {
    throw new Error('Set a default project location in Settings first.')
  }

  const folderName = sanitizeDirectoryFolderName(options.directoryName)
  if (folderName.length === 0) {
    throw new Error('Enter a project name.')
  }

  const parentDirectory = path.resolve(preferredDirectoryLocation)
  const directoryPath = path.join(parentDirectory, folderName)

  await mkdir(parentDirectory, { recursive: true })
  await mkdir(directoryPath, { recursive: true })

  if (options.initializeGit) {
    await initializeDirectoryGit(directoryPath)
  }

  const result = await startChatForNewlyVisibleDirectory(directoryPath)
  return result
}

export async function addDirectoryFromPath(options: {
  directoryPath: string
  createIfMissing: boolean
  initializeGit: boolean
}) {
  const directoryPath = expandHomePath(options.directoryPath.trim())
  if (directoryPath.length === 0) {
    throw new Error('Choose a folder to add.')
  }

  const candidateDirectoryPath = path.resolve(directoryPath)
  const exists = await directoryExists(candidateDirectoryPath)
  if (!(exists || options.createIfMissing)) {
    throw new Error('Choose an existing folder or create a new one.')
  }

  if (!exists) {
    await mkdir(candidateDirectoryPath, { recursive: true })
  }

  const resolvedDirectoryPath = await resolvePathIfPresent(candidateDirectoryPath)

  if (options.initializeGit) {
    await initializeDirectoryGit(resolvedDirectoryPath)
  }

  const result = await startChatForNewlyVisibleDirectory(resolvedDirectoryPath)
  return result
}

async function resolvePathIfPresent(directoryPath: string) {
  try {
    return await realpath(directoryPath)
  } catch {
    return path.resolve(directoryPath)
  }
}

async function directoryExists(directoryPath: string) {
  try {
    return (await stat(directoryPath)).isDirectory()
  } catch {
    return false
  }
}

async function addExistingRepositoryDirectory(directoryPath: string, repositoryUrl: string) {
  if (!((await directoryExists(directoryPath)) && (await isGitRepository(directoryPath)))) {
    return null
  }

  const originUrl = await getOriginUrl(directoryPath)
  if (!isSameGitHubRepository(originUrl, repositoryUrl)) {
    return null
  }

  ensureDirectory(directoryPath)
  await recordRootGitProvenance(directoryPath)
  setDirectoryRepoOrigin(directoryPath, originUrl ?? repositoryUrl)
  return { directoryId: directoryPath }
}

async function findExistingGitHubDirectory(repositoryUrl: string) {
  const directories = listDirectories(getDesktopWorkingDirectory())

  for (const directory of directories) {
    if (isSameGitHubRepository(directory.repoOriginUrl, repositoryUrl)) {
      return directory.id
    }
  }

  for (const directory of directories) {
    if (!(await isGitRepository(directory.id))) {
      continue
    }

    const originUrl = await getOriginUrl(directory.id)
    if (isSameGitHubRepository(originUrl, repositoryUrl)) {
      setDirectoryRepoOrigin(directory.id, originUrl)
      return directory.id
    }
  }

  return null
}

export async function createDirectoryFromGitHubUrl(options: {
  preferredDirectoryLocation: string | null
  repositoryUrl: string
}) {
  const preferredDirectoryLocation = options.preferredDirectoryLocation?.trim() ?? ''
  if (preferredDirectoryLocation.length === 0) {
    throw new Error('Set a default project location in Settings first.')
  }

  const repository = parseGitHubRepositoryUrl(options.repositoryUrl)
  if (!repository) {
    throw new Error('Paste a GitHub repository URL such as https://github.com/owner/repo.')
  }

  const existingDirectoryId = await findExistingGitHubDirectory(repository.canonicalUrl)
  if (existingDirectoryId) {
    return { directoryId: existingDirectoryId }
  }

  const parentDirectory = path.resolve(preferredDirectoryLocation)
  const directoryPath = path.join(
    parentDirectory,
    sanitizeDirectoryFolderName(repository.folderName),
  )
  await mkdir(parentDirectory, { recursive: true })

  const existingDirectoryDirectory = await addExistingRepositoryDirectory(
    directoryPath,
    repository.canonicalUrl,
  )
  if (existingDirectoryDirectory) {
    return existingDirectoryDirectory
  }

  if (await directoryExists(directoryPath)) {
    throw new Error(
      `A folder named ${repository.folderName} already exists there. Choose an empty location before cloning this GitHub repository.`,
    )
  }

  try {
    await execFile('git', ['clone', '--progress', repository.cloneUrl, directoryPath], {
      cwd: parentDirectory,
      env: getNonInteractiveGitEnv(),
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 4,
    })
  } catch (error) {
    const resolvedDirectoryPath = await resolvePathIfPresent(directoryPath)
    const resolvedExistingDirectory = await findExistingGitHubDirectory(repository.canonicalUrl)
    if (
      resolvedExistingDirectory &&
      (await resolvePathIfPresent(resolvedExistingDirectory)) === resolvedDirectoryPath
    ) {
      return { directoryId: resolvedExistingDirectory }
    }

    throw new Error(`Unable to clone ${repository.canonicalUrl}: ${formatGitCommandError(error)}`)
  }

  const result = await startChatForNewlyVisibleDirectory(directoryPath)
  setDirectoryRepoOrigin(directoryPath, repository.canonicalUrl)
  return result
}
