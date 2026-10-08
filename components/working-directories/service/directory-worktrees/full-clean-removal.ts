import { lstat, rm } from 'node:fs/promises'
import path from 'node:path'
import { resolveDirectoryIdentity } from '../../../../desktop/directory-identity.ts'
import {
  formatGitCommandError,
  type GitWorktreeEntry,
  loadGitRepositoryIdentity,
  loadGitWorktrees,
  runGitWithOptions,
  withRootGitMutation,
} from '../../../git/service/index.ts'
import type { StoredDirectoryWorktree } from '../state.ts'

type GitWorkspaceProbe = {
  branchName: string | null
  commonDirectoryIdentity: string | null
  topLevelIdentity: string
}

type VerifiedGitWorkspaceProbe = GitWorkspaceProbe & { commonDirectoryIdentity: string }

type RemovalContext = {
  rootEntry: GitWorktreeEntry
  rootIdentity: string
  rootProbe: VerifiedGitWorkspaceProbe
  worktreeByIdentity: Map<string, GitWorktreeEntry>
}

type ValidatedRemoval = {
  entry: GitWorktreeEntry
  metadata: StoredDirectoryWorktree
}

type RemovalError = { error: string }

function ownershipError(directoryId: string, reason: string): RemovalError {
  return {
    error:
      `Full clean was refused for ${directoryId}: ${reason} ` +
      'Set "WorkingDirectory deletion cleanup" to "Pi only" in Settings to remove Pi data without deleting this folder.',
  }
}

async function probeGitWorkspace(directoryId: string): Promise<GitWorkspaceProbe | RemovalError> {
  try {
    const [repositoryIdentity, { stdout: branchOutput }] = await Promise.all([
      loadGitRepositoryIdentity(directoryId),
      runGitWithOptions(directoryId, ['branch', '--show-current'], {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      }),
    ])
    return {
      ...repositoryIdentity,
      branchName: branchOutput.trim() || null,
    }
  } catch (error) {
    return ownershipError(directoryId, formatGitCommandError(error))
  }
}

async function resolveRemovalContext(
  rootDirectoryId: string,
  expectedCommonDirectoryIdentity: string,
): Promise<RemovalContext | RemovalError> {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(rootDirectoryId)
  } catch (error) {
    return ownershipError(rootDirectoryId, formatGitCommandError(error))
  }

  const rootEntry = worktrees[0]
  if (!rootEntry || rootEntry.prunable) {
    return ownershipError(rootDirectoryId, 'Git does not report a live main worktree.')
  }

  const rootProbe = await probeGitWorkspace(rootEntry.path)
  if ('error' in rootProbe) return rootProbe
  if (rootProbe.commonDirectoryIdentity !== expectedCommonDirectoryIdentity) {
    return ownershipError(rootDirectoryId, 'The saved Git repository identity no longer matches.')
  }

  const [requestedRootIdentity, rootEntryIdentity] = await Promise.all([
    resolveDirectoryIdentity(rootDirectoryId),
    resolveDirectoryIdentity(rootEntry.path),
  ])
  if (
    requestedRootIdentity !== rootEntryIdentity ||
    rootProbe.topLevelIdentity !== rootEntryIdentity
  ) {
    return ownershipError(rootDirectoryId, 'The main worktree root changed.')
  }

  const worktreeByIdentity = new Map<string, GitWorktreeEntry>()
  for (const worktree of worktrees) {
    const identity = await resolveDirectoryIdentity(worktree.path)
    if (worktreeByIdentity.has(identity)) {
      return ownershipError(worktree.path, 'Git reported the workspace more than once.')
    }
    worktreeByIdentity.set(identity, worktree)
  }

  return {
    rootEntry,
    rootIdentity: rootEntryIdentity,
    rootProbe: { ...rootProbe, commonDirectoryIdentity: expectedCommonDirectoryIdentity },
    worktreeByIdentity,
  }
}

async function validateWorktreeRemoval(
  context: RemovalContext,
  metadata: StoredDirectoryWorktree,
): Promise<ValidatedRemoval | RemovalError> {
  if (metadata.isMain) {
    return ownershipError(
      metadata.cwd,
      'Persisted metadata identifies the path as the main worktree.',
    )
  }

  const [metadataIdentity, metadataRootIdentity] = await Promise.all([
    resolveDirectoryIdentity(metadata.cwd),
    resolveDirectoryIdentity(metadata.rootCwd),
  ])
  if (metadataRootIdentity !== context.rootIdentity) {
    return ownershipError(metadata.cwd, 'The persisted worktree root does not match Git.')
  }
  if (metadata.gitCommonDirectoryIdentity !== context.rootProbe.commonDirectoryIdentity) {
    return ownershipError(metadata.cwd, 'The saved Git repository identity does not match.')
  }
  if (metadataIdentity === context.rootIdentity) {
    return ownershipError(metadata.cwd, 'The path resolves to the main worktree.')
  }

  const entry = context.worktreeByIdentity.get(metadataIdentity)
  if (!entry || entry === context.rootEntry || entry.prunable) {
    return ownershipError(
      metadata.cwd,
      'Git does not report a live non-main worktree at this path.',
    )
  }
  if (entry.branch !== metadata.branchName) {
    return ownershipError(metadata.cwd, 'The worktree branch changed.')
  }

  const probe = await probeGitWorkspace(entry.path)
  if ('error' in probe) return probe
  if (
    probe.topLevelIdentity !== metadataIdentity ||
    probe.commonDirectoryIdentity !== context.rootProbe.commonDirectoryIdentity
  ) {
    return ownershipError(metadata.cwd, 'The live Git workspace does not belong to this directory.')
  }
  if (probe.branchName !== metadata.branchName) {
    return ownershipError(metadata.cwd, 'The live worktree branch changed.')
  }

  return { entry, metadata }
}

async function revalidateRoot(context: RemovalContext): Promise<RemovalError | null> {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(context.rootEntry.path)
  } catch (error) {
    return ownershipError(context.rootEntry.path, formatGitCommandError(error))
  }

  const rootEntry = worktrees[0]
  if (!rootEntry || rootEntry.prunable) {
    return ownershipError(context.rootEntry.path, 'Git no longer reports a live main worktree.')
  }
  const probe = await probeGitWorkspace(context.rootEntry.path)
  if ('error' in probe) return probe
  if (
    probe.topLevelIdentity !== context.rootIdentity ||
    probe.commonDirectoryIdentity !== context.rootProbe.commonDirectoryIdentity
  ) {
    return ownershipError(context.rootEntry.path, 'The main worktree identity changed.')
  }
  for (const worktree of worktrees.slice(1)) {
    if (!worktree.prunable) {
      return ownershipError(
        worktree.path,
        'Git reports a live linked worktree that was not removed with this directory.',
      )
    }
  }
  return null
}

async function validateRemovalTargets(
  context: RemovalContext,
  worktrees: StoredDirectoryWorktree[],
): Promise<ValidatedRemoval[] | RemovalError> {
  const validated: ValidatedRemoval[] = []
  const targetIdentities = new Set<string>()
  for (const metadata of worktrees) {
    const result = await validateWorktreeRemoval(context, metadata)
    if ('error' in result) return result
    const identity = await resolveDirectoryIdentity(result.entry.path)
    if (targetIdentities.has(identity)) {
      return ownershipError(
        metadata.cwd,
        'Persisted metadata identifies the worktree more than once.',
      )
    }
    targetIdentities.add(identity)
    validated.push(result)
  }
  for (const [identity, worktree] of context.worktreeByIdentity) {
    if (identity === context.rootIdentity || worktree.prunable) continue
    if (!targetIdentities.has(identity)) {
      return ownershipError(
        worktree.path,
        'Git reports this live linked worktree, but it has no saved deletion target.',
      )
    }
  }
  return validated
}

async function removeValidatedWorktrees(
  context: RemovalContext,
  validated: ValidatedRemoval[],
): Promise<RemovalError | null> {
  validated.sort((left, right) => right.entry.path.length - left.entry.path.length)
  for (const removal of validated) {
    const current = await validateWorktreeRemoval(context, removal.metadata)
    if ('error' in current) return current
    await rm(current.entry.path, { recursive: true, force: true })
  }
  return null
}

async function hasRootGitMetadata(rootDirectoryId: string): Promise<boolean | RemovalError> {
  try {
    await lstat(path.join(rootDirectoryId, '.git'))
    return true
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    return ownershipError(
      rootDirectoryId,
      `The .git entry could not be inspected: ${String(error)}`,
    )
  }
}

async function validateRootMetadata(
  rootDirectoryId: string,
  metadata: StoredDirectoryWorktree,
): Promise<RemovalError | string> {
  if (!metadata.isMain) {
    return ownershipError(rootDirectoryId, 'Saved metadata identifies this as a linked worktree.')
  }
  const [rootIdentity, metadataIdentity, metadataRootIdentity] = await Promise.all([
    resolveDirectoryIdentity(rootDirectoryId),
    resolveDirectoryIdentity(metadata.cwd),
    resolveDirectoryIdentity(metadata.rootCwd),
  ])
  if (metadataIdentity !== rootIdentity || metadataRootIdentity !== rootIdentity) {
    return ownershipError(rootDirectoryId, 'The saved main worktree path no longer matches.')
  }
  if (!metadata.gitCommonDirectoryIdentity) {
    return ownershipError(
      rootDirectoryId,
      'No Git repository identity was saved for this directory.',
    )
  }
  return metadata.gitCommonDirectoryIdentity
}

async function removeDirectoryDirectories(input: {
  rootWorktree: StoredDirectoryWorktree | null
  rootDirectoryId: string
  worktrees: StoredDirectoryWorktree[]
}): Promise<RemovalError | Record<string, never>> {
  const hasGitMetadata = await hasRootGitMetadata(input.rootDirectoryId)
  if (typeof hasGitMetadata !== 'boolean') return hasGitMetadata

  if (!input.rootWorktree) {
    if (input.worktrees.length > 0) {
      return ownershipError(
        input.rootDirectoryId,
        'Saved linked worktrees exist without saved main worktree metadata.',
      )
    }
    if (hasGitMetadata) {
      return ownershipError(
        input.rootDirectoryId,
        'Git metadata is present, but Howcode has no saved repository identity.',
      )
    }
    await rm(input.rootDirectoryId, { recursive: true, force: true })
    return {}
  }

  const expectedCommonDirectoryIdentity = await validateRootMetadata(
    input.rootDirectoryId,
    input.rootWorktree,
  )
  if (typeof expectedCommonDirectoryIdentity !== 'string') {
    return expectedCommonDirectoryIdentity
  }
  if (!hasGitMetadata) {
    return ownershipError(
      input.rootDirectoryId,
      'This was saved as a Git project, but its .git entry is no longer present.',
    )
  }

  const context = await resolveRemovalContext(
    input.rootDirectoryId,
    expectedCommonDirectoryIdentity,
  )
  if ('error' in context) return context

  const validated = await validateRemovalTargets(context, input.worktrees)
  if ('error' in validated) return validated

  const worktreeError = await removeValidatedWorktrees(context, validated)
  if (worktreeError) return worktreeError

  const rootError = await revalidateRoot(context)
  if (rootError) return rootError
  await rm(context.rootEntry.path, { recursive: true, force: true })
  return {}
}

export async function removeFullCleanDirectoryDirectories(input: {
  rootWorktree: StoredDirectoryWorktree | null
  rootDirectoryId: string
  worktrees: StoredDirectoryWorktree[]
}): Promise<RemovalError | Record<string, never>> {
  return withRootGitMutation(input.rootDirectoryId, () => removeDirectoryDirectories(input))
}
