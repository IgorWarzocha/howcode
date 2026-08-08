import { describe, expect, it } from 'vitest'
import {
  reviewTargetFromPierreSelection,
  reviewTargetToPierreAnnotation,
  reviewTargetToPierreSelection,
} from '../app/native/gitops/review/pierre-review-adapter'
import { buildReviewAnnotations } from '../app/native/gitops/review/review-annotations'
import {
  idleReviewInteraction,
  reduceReviewInteraction,
} from '../app/native/gitops/review/review-interaction'
import {
  createLineRangeTarget,
  describeReviewTarget,
  normalizeLineRangeTarget,
  type SavedReviewComment,
} from '../app/native/gitops/review/review-model'
import { buildReviewPrompt } from '../app/native/gitops/review/review-prompt'
import {
  decodePersistedReviewContext,
  getReviewContextId,
} from '../app/native/gitops/review/review-store'

const commentTarget = createLineRangeTarget({
  fileKey: 'src/app.ts',
  filePath: 'src/app.ts',
  side: 'additions',
  lineNumber: 12,
  endLineNumber: 14,
})

const comment: SavedReviewComment = {
  id: 'comment-1',
  target: commentTarget,
  body: '  Keep this branch explicit.  ',
  createdAt: '2026-03-01T12:00:00.000Z',
}

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

  it('describes line, range, cross-side, and file targets', () => {
    expect(describeReviewTarget(comment.target)).toBe('New lines 12-14')
    expect(
      describeReviewTarget(
        createLineRangeTarget({
          fileKey: 'file',
          filePath: 'src/file.ts',
          side: 'deletions',
          lineNumber: 6,
        }),
      ),
    ).toBe('Old line 6')
    expect(
      describeReviewTarget(
        createLineRangeTarget({
          fileKey: 'file',
          filePath: 'src/file.ts',
          side: 'deletions',
          lineNumber: 8,
          endSide: 'additions',
          endLineNumber: 10,
        }),
      ),
    ).toBe('Old line 8 → New line 10')
    expect(describeReviewTarget({ kind: 'file', fileKey: 'file', filePath: 'src/file.ts' })).toBe(
      'File comment',
    )
  })

  it('adapts controlled Pierre selections and annotations at one boundary', () => {
    const target = reviewTargetFromPierreSelection({
      fileKey: 'file',
      filePath: 'src/file.ts',
      range: { side: 'deletions', start: 5, endSide: 'additions', end: 7 },
    })

    expect(target).not.toBeNull()
    expect(reviewTargetToPierreSelection(target!)).toEqual({
      side: 'deletions',
      start: 5,
      endSide: 'additions',
      end: 7,
    })
    expect(
      reviewTargetToPierreAnnotation({
        id: 'comment-1',
        body: 'Review this.',
        kind: 'comment',
        target: target!,
      }),
    ).toMatchObject({
      side: 'deletions',
      lineNumber: 5,
      metadata: { review: { id: 'comment-1', kind: 'comment', target } },
    })
    expect(
      reviewTargetFromPierreSelection({
        fileKey: 'file',
        filePath: 'src/file.ts',
        range: { start: 5, end: 7 },
      }),
    ).toBeNull()
  })

  it('builds the existing review prompt with trimmed copy', () => {
    expect(
      buildReviewPrompt({ comments: [comment], instruction: '  Please address these. ' }),
    ).toBe(`Please address these.

1. src/app.ts:12-14 (new side)
   Keep this branch explicit.`)
  })

  it('keeps selection actions ephemeral and promotes them into drafts explicitly', () => {
    const selected = reduceReviewInteraction(idleReviewInteraction, {
      type: 'select',
      target: commentTarget,
    })

    expect(selected).toEqual({ kind: 'selection', target: commentTarget })
    expect(buildReviewAnnotations({ comments: [], interaction: selected })).toMatchObject(
      new Map([
        [
          'src/app.ts',
          [
            {
              metadata: {
                review: { kind: 'selection-action', target: commentTarget },
              },
            },
          ],
        ],
      ]),
    )

    const extendedTarget = createLineRangeTarget({
      fileKey: commentTarget.fileKey,
      filePath: commentTarget.filePath,
      side: 'additions',
      lineNumber: 12,
      endLineNumber: 16,
    })
    const extended = reduceReviewInteraction(selected, {
      type: 'select',
      target: extendedTarget,
    })
    const selectedAnnotation = buildReviewAnnotations({
      comments: [],
      interaction: selected,
    }).get(commentTarget.fileKey)?.[0]
    const extendedAnnotation = buildReviewAnnotations({
      comments: [],
      interaction: extended,
    }).get(commentTarget.fileKey)?.[0]
    expect(extendedAnnotation?.metadata.review.id).not.toBe(selectedAnnotation?.metadata.review.id)

    const drafting = reduceReviewInteraction(selected, {
      type: 'start-draft',
      target: commentTarget,
    })
    expect(drafting).toEqual({ kind: 'draft', draft: { target: commentTarget, body: '' } })

    const typed = reduceReviewInteraction(drafting, {
      type: 'set-draft-body',
      body: 'Keep this thought.',
    })
    expect(reduceReviewInteraction(typed, { type: 'select', target: commentTarget })).toBe(typed)
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
