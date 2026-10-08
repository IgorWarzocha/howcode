import { getBranch, getOriginUrl } from './directory-state.ts'
import { hasHeadCommit, runGitWithOptions, withTemporaryIndex } from './git-runner.ts'

const shortStatInsertionsPattern = /(\d+)\s+insertions?\(\+\)/
const shortStatDeletionsPattern = /(\d+)\s+deletions?\(-\)/

export type CommitContextOutputs = Awaited<ReturnType<typeof loadCommitContextOutputs>>

export function parseShortStat(output: string) {
  const insertionsMatch = output.match(shortStatInsertionsPattern)
  const deletionsMatch = output.match(shortStatDeletionsPattern)

  return {
    insertions: insertionsMatch ? Number.parseInt(insertionsMatch[1] ?? '0', 10) : 0,
    deletions: deletionsMatch ? Number.parseInt(deletionsMatch[1] ?? '0', 10) : 0,
  }
}

export function countNonEmptyLines(output: string) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length
}

function diffArguments(hasHead: boolean, extraArgs: string[]) {
  return ['diff', '--cached', ...(hasHead ? [] : ['--root']), ...extraArgs, '--']
}

async function runDiffOutput(
  directoryId: string,
  hasHead: boolean,
  extraArgs: string[],
  env: NodeJS.ProcessEnv,
  maxBuffer = 1024 * 1024 * 4,
) {
  return runGitWithOptions(directoryId, diffArguments(hasHead, extraArgs), {
    env,
    timeout: 10_000,
    maxBuffer,
  }).then(
    ({ stdout }) => stdout.trim(),
    () => '',
  )
}

export async function loadCommitContextOutputs(
  directoryId: string,
  options?: { env?: NodeJS.ProcessEnv; hasHead?: boolean },
) {
  const env = options?.env ?? process.env
  const hasHead = options?.hasHead ?? (await hasHeadCommit(directoryId))
  const [
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  ] = await Promise.all([
    getBranch(directoryId),
    getOriginUrl(directoryId),
    runDiffOutput(directoryId, hasHead, ['--shortstat'], env),
    runDiffOutput(directoryId, hasHead, ['--stat=200,200', '--find-renames'], env),
    runDiffOutput(directoryId, hasHead, ['--name-status', '--find-renames'], env),
    runDiffOutput(directoryId, hasHead, ['--numstat', '--find-renames'], env),
    runDiffOutput(
      directoryId,
      hasHead,
      ['--unified=1', '--no-color', '--no-ext-diff', '--find-renames'],
      env,
      1024 * 1024 * 12,
    ),
  ])

  return {
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  }
}

export async function loadCommitContextOutputsForMode(
  directoryId: string,
  includeUnstaged: boolean,
  includeUntracked: boolean,
) {
  if (!includeUnstaged) return loadCommitContextOutputs(directoryId)
  return withTemporaryIndex(directoryId, async ({ env, hasHead }) => {
    await runGitWithOptions(directoryId, ['add', includeUntracked ? '-A' : '-u', '--', '.'], {
      env,
      timeout: 10_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return loadCommitContextOutputs(directoryId, { env, hasHead })
  })
}
