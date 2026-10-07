import { hasHeadCommit, runGitWithOptions, withTemporaryIndex } from './git-runner.ts'
import { getBranch, getOriginUrl } from './project-state.ts'

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
  projectId: string,
  hasHead: boolean,
  extraArgs: string[],
  env: NodeJS.ProcessEnv,
  maxBuffer = 1024 * 1024 * 4,
) {
  return runGitWithOptions(projectId, diffArguments(hasHead, extraArgs), {
    env,
    timeout: 10_000,
    maxBuffer,
  }).then(
    ({ stdout }) => stdout.trim(),
    () => '',
  )
}

export async function loadCommitContextOutputs(
  projectId: string,
  options?: { env?: NodeJS.ProcessEnv; hasHead?: boolean },
) {
  const env = options?.env ?? process.env
  const hasHead = options?.hasHead ?? (await hasHeadCommit(projectId))
  const [
    branch,
    originUrl,
    shortStatOutput,
    diffStatOutput,
    nameStatusOutput,
    numStatOutput,
    patchOutput,
  ] = await Promise.all([
    getBranch(projectId),
    getOriginUrl(projectId),
    runDiffOutput(projectId, hasHead, ['--shortstat'], env),
    runDiffOutput(projectId, hasHead, ['--stat=200,200', '--find-renames'], env),
    runDiffOutput(projectId, hasHead, ['--name-status', '--find-renames'], env),
    runDiffOutput(projectId, hasHead, ['--numstat', '--find-renames'], env),
    runDiffOutput(
      projectId,
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
  projectId: string,
  includeUnstaged: boolean,
  includeUntracked: boolean,
) {
  if (!includeUnstaged) return loadCommitContextOutputs(projectId)
  return withTemporaryIndex(projectId, async ({ env, hasHead }) => {
    await runGitWithOptions(projectId, ['add', includeUntracked ? '-A' : '-u', '--', '.'], {
      env,
      timeout: 10_000,
      maxBuffer: 1024 * 1024 * 4,
    })
    return loadCommitContextOutputs(projectId, { env, hasHead })
  })
}
