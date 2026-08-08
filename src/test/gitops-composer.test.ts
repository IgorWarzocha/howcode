import { describe, expect, it } from 'vitest'
import type { DesktopActionResult } from '../app/desktop/types'
import {
  canCommitGitOps,
  getCommittableFileCount,
  getGitOpsCommitOutcome,
  getPrimaryGitOpsActionLabel,
} from '../app/native/gitops/composer-primary-action'

const scope = {
  fileCount: 5,
  includeUnstaged: true,
  includeUntracked: true,
  stagedFileCount: 2,
  untrackedFileCount: 1,
}

function commitResult(
  result: Exclude<DesktopActionResult['result'], undefined>,
): DesktopActionResult {
  return {
    at: '2026-03-01T12:00:00.000Z',
    ok: true,
    payload: { action: 'workspace.commit', payload: {} },
    result,
  }
}

describe('GitOps composer primary action', () => {
  it('derives the committable scope without counting excluded files', () => {
    expect(getCommittableFileCount(scope)).toBe(5)
    expect(getCommittableFileCount({ ...scope, includeUntracked: false })).toBe(4)
    expect(getCommittableFileCount({ ...scope, includeUnstaged: false })).toBe(2)
    expect(canCommitGitOps({ ...scope, isGitRepo: false })).toBe(false)
    expect(canCommitGitOps({ ...scope, fileCount: 0, stagedFileCount: 0, isGitRepo: true })).toBe(
      false,
    )
  })

  it('prioritizes review submission over repository actions', () => {
    expect(
      getPrimaryGitOpsActionLabel({
        canCommit: true,
        diffCommentsSending: false,
        hasDiffComments: true,
        isGitRepo: true,
        pushEnabled: true,
      }),
    ).toBe('Send comments')
    expect(
      getPrimaryGitOpsActionLabel({
        canCommit: false,
        diffCommentsSending: false,
        hasDiffComments: false,
        isGitRepo: false,
        pushEnabled: false,
      }),
    ).toBe('Init git')
    expect(
      getPrimaryGitOpsActionLabel({
        canCommit: true,
        diffCommentsSending: false,
        hasDiffComments: false,
        isGitRepo: true,
        pushEnabled: true,
      }),
    ).toBe('Commit & push')
  })

  it('turns preview and commit results into explicit UI outcomes', () => {
    expect(getGitOpsCommitOutcome(commitResult({ message: 'Draft', previewed: true }), '')).toEqual(
      {
        committed: false,
        errorMessage: null,
        nextMessage: 'Draft',
        persistedMessage: null,
        previewed: true,
        statusMessage: null,
      },
    )
    expect(
      getGitOpsCommitOutcome(
        commitResult({ committed: true, error: 'Invalid mixed result', previewed: true }),
        '',
      ),
    ).toMatchObject({ committed: false, errorMessage: null, previewed: true })
    expect(
      getGitOpsCommitOutcome(
        commitResult({ committed: true, pushed: true }),
        'Keep submitted message',
      ),
    ).toEqual({
      committed: true,
      errorMessage: null,
      nextMessage: null,
      persistedMessage: 'Keep submitted message',
      previewed: false,
      statusMessage: 'Committed and pushed successfully.',
    })
    expect(
      getGitOpsCommitOutcome(commitResult({ committed: true, error: 'Push failed.' }), 'Commit'),
    ).toMatchObject({
      committed: true,
      errorMessage: 'Push failed.',
      statusMessage: null,
    })
  })
})
