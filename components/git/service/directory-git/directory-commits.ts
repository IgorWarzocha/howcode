const headDecorationPattern = /(^|,\s*)HEAD(?:\s*->\s*[^,]+)?(?:,|$)/
const trailingLineBreakPattern = /\n$/

import type { DirectoryCommitEntry } from '../../../../shared/desktop-contracts.ts'
import { isGitRepository } from './directory-state.ts'
import { runGitWithOptions } from './git-runner.ts'

const FIELD_SEPARATOR = '\0'
const COMMIT_FIELD_COUNT = 8
const COMMIT_PRETTY_FORMAT = ['%H', '%h', '%an', '%ae', '%aI', '%cI', '%D', '%s'].join('%x00')

function parseDecorations(rawDecorations: string) {
  const value = rawDecorations.trim()
  return value.length > 0 ? [value] : []
}

function parseCommitEntry(fields: string[]): DirectoryCommitEntry | null {
  const [sha, shortSha, authorName, authorEmail, authoredAt, committedAt, rawDecorations, subject] =
    fields

  if (!(sha && shortSha)) {
    return null
  }

  const decorations = parseDecorations(rawDecorations ?? '')

  return {
    sha,
    shortSha,
    subject: subject ?? '',
    authorName: authorName ?? '',
    authorEmail: authorEmail ?? '',
    authoredAt: authoredAt ?? '',
    committedAt: committedAt ?? '',
    decorations,
    isHead: headDecorationPattern.test(rawDecorations ?? ''),
  }
}

function parseCommitEntries(output: string) {
  const fields = output.replace(trailingLineBreakPattern, '').split(FIELD_SEPARATOR)
  const commits: DirectoryCommitEntry[] = []
  for (let index = 0; index + COMMIT_FIELD_COUNT <= fields.length; index += COMMIT_FIELD_COUNT) {
    const commit = parseCommitEntry(fields.slice(index, index + COMMIT_FIELD_COUNT))
    if (commit) commits.push(commit)
  }
  return commits
}

export async function resolveCommitRevision(
  directoryId: string,
  rev: string,
): Promise<string | null> {
  try {
    const { stdout } = await runGitWithOptions(
      directoryId,
      ['rev-parse', '--verify', `${rev}^{commit}`],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 128,
      },
    )

    const resolvedRev = stdout.trim()
    return resolvedRev.length > 0 ? resolvedRev : null
  } catch {
    return null
  }
}

export async function getDirectoryCommitEntry(
  directoryId: string,
  rev: string,
): Promise<DirectoryCommitEntry | null> {
  const resolvedRev = await resolveCommitRevision(directoryId, rev)
  if (!resolvedRev) {
    return null
  }

  const { stdout } = await runGitWithOptions(
    directoryId,
    ['show', '--no-patch', '--decorate=short', `--format=${COMMIT_PRETTY_FORMAT}`, resolvedRev],
    {
      timeout: 10_000,
      maxBuffer: 1024 * 512,
    },
  )

  return parseCommitEntries(stdout)[0] ?? null
}

export async function listDirectoryCommits(
  directoryId: string,
  limit?: number | undefined | null,
): Promise<DirectoryCommitEntry[]> {
  if (!(await isGitRepository(directoryId))) {
    return []
  }

  const normalizedLimit = Math.min(Math.max(limit ?? 50, 1), 200)

  let stdout = ''

  try {
    ;({ stdout } = await runGitWithOptions(
      directoryId,
      [
        'log',
        '-z',
        `--max-count=${normalizedLimit}`,
        '--decorate=short',
        `--format=${COMMIT_PRETTY_FORMAT}`,
      ],
      {
        timeout: 10_000,
        maxBuffer: 1024 * 1024 * 4,
      },
    ))
  } catch {
    return []
  }

  return parseCommitEntries(stdout)
}
