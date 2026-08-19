import { describe, expect, it } from 'vitest'
import { normalizeLineRangeTarget } from '../app/native/gitops/review/review-model'
import {
  decodePersistedReviewContext,
  getReviewContextId,
} from '../app/native/gitops/review/review-store'

describe('GitOps review model', () => {
  it('normalizes same-side ranges while preserving cross-side direction', () => {
    expect(
      normalizeLineRangeTarget({
        fileKey: 'file',
        filePath: 'src/file.ts',
        start: { side: 'additions', lineNumber: 9 },
        end: { side: 'additions', lineNumber: 4 },
      }),
    ).toMatchObject({
      start: { side: 'additions', lineNumber: 4 },
      end: { side: 'additions', lineNumber: 9 },
    })

    expect(
      normalizeLineRangeTarget({
        fileKey: 'file',
        filePath: 'src/file.ts',
        start: { side: 'additions', lineNumber: 7 },
        end: { side: 'deletions', lineNumber: 3 },
      }),
    ).toMatchObject({
      start: { side: 'additions', lineNumber: 7 },
      end: { side: 'deletions', lineNumber: 3 },
    })
  })
})

describe('GitOps review persistence contract', () => {
  it('decodes legacy v1 values into explicit targets and drops invalid records', () => {
    expect(
      decodePersistedReviewContext({
        comments: [
          {
            id: 'valid',
            fileKey: 'src/app.ts',
            filePath: 'src/app.ts',
            side: 'additions',
            lineNumber: 9,
            endLineNumber: 11,
            body: 'Keep me.',
            createdAt: '2026-03-01T12:00:00.000Z',
          },
          {
            id: 'invalid',
            fileKey: 'src/app.ts',
            filePath: 'src/app.ts',
            side: 'middle',
            lineNumber: 9,
            body: 'Drop me.',
            createdAt: '2026-03-01T12:00:00.000Z',
          },
        ],
        draft: {
          fileKey: 'src/other.ts',
          filePath: 'src/other.ts',
          side: 'deletions',
          lineNumber: 2,
          body: 'Draft.',
        },
      }),
    ).toEqual({
      comments: [
        {
          id: 'valid',
          target: {
            kind: 'line-range',
            fileKey: 'src/app.ts',
            filePath: 'src/app.ts',
            start: { side: 'additions', lineNumber: 9 },
            end: { side: 'additions', lineNumber: 11 },
          },
          body: 'Keep me.',
          purpose: 'comment',
          createdAt: '2026-03-01T12:00:00.000Z',
        },
      ],
      draft: {
        target: {
          kind: 'line-range',
          fileKey: 'src/other.ts',
          filePath: 'src/other.ts',
          start: { side: 'deletions', lineNumber: 2 },
          end: { side: 'deletions', lineNumber: 2 },
        },
        body: 'Draft.',
        purpose: 'comment',
      },
    })
  })

  it('scopes contexts by project, baseline, and untracked mode', () => {
    const head = getReviewContextId({ projectId: '/repo' })
    expect(head).toBe('project:/repo:worktree-diff:head:untracked:hidden')
    expect(getReviewContextId({ projectId: '' })).toBeNull()
    expect(
      getReviewContextId({
        projectId: '/repo',
        baseline: { kind: 'commit', sha: 'abc123' },
      }),
    ).not.toBe(head)
    expect(
      getReviewContextId({
        projectId: '/repo',
        baseline: { kind: 'head' },
        includeUntracked: true,
      }),
    ).not.toBe(head)
  })
})
