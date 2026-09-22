import { rm } from 'node:fs/promises'
import { formatGitCommandError, runGitWithOptions } from '../project-git/git-runner.ts'
import { type GitWorktreeEntry, loadGitWorktrees } from '../project-git/worktrees.ts'
import type { StoredProjectWorktree } from '../thread-state-db.ts'
import { resolveWorkspaceIdentity } from '../workspace-identity.ts'
import { withRootGitMutation } from './root-git-mutation-gate.ts'

type GitWorkspaceProbe = {
  branchName: string | null
  commonDirectoryIdentity: string
  topLevelIdentity: string
}

type RemovalContext = {
  rootEntry: GitWorktreeEntry
  rootIdentity: string
  rootProbe: GitWorkspaceProbe
  worktreeByIdentity: Map<string, GitWorktreeEntry>
}

type ValidatedRemoval = {
  entry: GitWorktreeEntry
  metadata: StoredProjectWorktree
}

type RemovalError = { error: string }

function ownershipError(projectId: string, reason: string): RemovalError {
  return {
    error: `Cannot fully delete the project because worktree ownership could not be verified for ${projectId}: ${reason}`,
  }
}

async function probeGitWorkspace(projectId: string): Promise<GitWorkspaceProbe | RemovalError> {
  try {
    const [{ stdout: pathsOutput }, { stdout: branchOutput }] = await Promise.all([
      runGitWithOptions(
        projectId,
        ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'],
        { timeout: 10_000, maxBuffer: 1024 * 128 },
      ),
      runGitWithOptions(projectId, ['branch', '--show-current'], {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      }),
    ])
    const paths = pathsOutput
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)
    const [topLevelPath, commonDirectoryPath] = paths
    if (!(topLevelPath && commonDirectoryPath && paths.length === 2)) {
      return ownershipError(projectId, 'Git returned an invalid workspace identity.')
    }

    const [topLevelIdentity, commonDirectoryIdentity] = await Promise.all([
      resolveWorkspaceIdentity(topLevelPath),
      resolveWorkspaceIdentity(commonDirectoryPath),
    ])
    return {
      topLevelIdentity,
      commonDirectoryIdentity,
      branchName: branchOutput.trim() || null,
    }
  } catch (error) {
    return ownershipError(projectId, formatGitCommandError(error))
  }
}

async function resolveRemovalContext(
  rootProjectId: string,
): Promise<RemovalContext | RemovalError> {
  let worktrees: GitWorktreeEntry[]
  try {
    worktrees = await loadGitWorktrees(rootProjectId)
  } catch (error) {
    return ownershipError(rootProjectId, formatGitCommandError(error))
  }

  const rootEntry = worktrees[0]
  if (!rootEntry || rootEntry.prunable) {
    return ownershipError(rootProjectId, 'Git does not report a live main worktree.')
  }

  const rootProbe = await probeGitWorkspace(rootEntry.path)
  if ('error' in rootProbe) return rootProbe

  const [requestedRootIdentity, rootEntryIdentity] = await Promise.all([
    resolveWorkspaceIdentity(rootProjectId),
    resolveWorkspaceIdentity(rootEntry.path),
  ])
  if (
    requestedRootIdentity !== rootEntryIdentity ||
    rootProbe.topLevelIdentity !== rootEntryIdentity
  ) {
    return ownershipError(rootProjectId, 'The main worktree root changed.')
  }

  const worktreeByIdentity = new Map<string, GitWorktreeEntry>()
  for (const worktree of worktrees) {
    const identity = await resolveWorkspaceIdentity(worktree.path)
    if (worktreeByIdentity.has(identity)) {
      return ownershipError(worktree.path, 'Git reported the workspace more than once.')
    }
    worktreeByIdentity.set(identity, worktree)
  }

  return {
    rootEntry,
    rootIdentity: rootEntryIdentity,
    rootProbe,
    worktreeByIdentity,
  }
}

async function validateWorktreeRemoval(
  context: RemovalContext,
  metadata: StoredProjectWorktree,
): Promise<ValidatedRemoval | RemovalError> {
  if (metadata.isMain) {
    return ownershipError(
      metadata.cwd,
      'Persisted metadata identifies the path as the main worktree.',
    )
  }

  const [metadataIdentity, metadataRootIdentity] = await Promise.all([
    resolveWorkspaceIdentity(metadata.cwd),
    resolveWorkspaceIdentity(metadata.rootCwd),
  ])
  if (metadataRootIdentity !== context.rootIdentity) {
    return ownershipError(metadata.cwd, 'The persisted worktree root does not match Git.')
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
    return ownershipError(metadata.cwd, 'The live Git workspace does not belong to this project.')
  }
  if (probe.branchName !== metadata.branchName) {
    return ownershipError(metadata.cwd, 'The live worktree branch changed.')
  }

  return { entry, metadata }
}

async function revalidateRoot(context: RemovalContext): Promise<RemovalError | null> {
  const probe = await probeGitWorkspace(context.rootEntry.path)
  if ('error' in probe) return probe
  if (
    probe.topLevelIdentity !== context.rootIdentity ||
    probe.commonDirectoryIdentity !== context.rootProbe.commonDirectoryIdentity
  ) {
    return ownershipError(context.rootEntry.path, 'The main worktree identity changed.')
  }
  return null
}

async function validateRemovalTargets(
  context: RemovalContext,
  worktrees: StoredProjectWorktree[],
): Promise<ValidatedRemoval[] | RemovalError> {
  const validated: ValidatedRemoval[] = []
  const targetIdentities = new Set<string>()
  for (const metadata of worktrees) {
    const result = await validateWorktreeRemoval(context, metadata)
    if ('error' in result) return result
    const identity = await resolveWorkspaceIdentity(result.entry.path)
    if (targetIdentities.has(identity)) {
      return ownershipError(
        metadata.cwd,
        'Persisted metadata identifies the worktree more than once.',
      )
    }
    targetIdentities.add(identity)
    validated.push(result)
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

async function removeProjectDirectories(input: {
  rootProjectId: string
  worktrees: StoredProjectWorktree[]
}): Promise<RemovalError | Record<string, never>> {
  if (input.worktrees.length === 0) {
    await rm(input.rootProjectId, { recursive: true, force: true })
    return {}
  }

  const context = await resolveRemovalContext(input.rootProjectId)
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

export async function removeFullCleanProjectDirectories(input: {
  rootProjectId: string
  worktrees: StoredProjectWorktree[]
}): Promise<RemovalError | Record<string, never>> {
  return withRootGitMutation(input.rootProjectId, () => removeProjectDirectories(input))
}
