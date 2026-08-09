import { parseDiffFromFile } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'
import {
  buildChangeReviewAnnotations,
  getChangeRejectionTarget,
  keepReviewedChange,
} from '../app/native/gitops/review/change-review-model'

function createDiff(oldContents: string, newContents: string) {
  return parseDiffFromFile(
    { name: 'example.ts', contents: oldContents },
    { name: 'example.ts', contents: newContents },
  )
}

describe('GitOps Pierre change review', () => {
  it('anchors one canonical Keep/Reject action to each unresolved hunk', () => {
    const changed = createDiff('one\ntwo\nthree\n', 'one\nTWO\nthree\n')
    const deleted = createDiff('one\ntwo\n', 'one\n')

    expect(buildChangeReviewAnnotations('changed', changed)).toEqual([
      {
        side: 'additions',
        lineNumber: 2,
        metadata: {
          gitOps: { kind: 'change-action', fileKey: 'changed', hunkIndex: 0 },
        },
      },
    ])
    expect(buildChangeReviewAnnotations('deleted', deleted)[0]).toMatchObject({
      side: 'deletions',
      lineNumber: 2,
    })
  })

  it('keeps accepted hunks locally and turns rejection into an agent-review target', () => {
    const source = createDiff('one\ntwo\nthree\n', 'one\nTWO\nthree\n')

    const kept = keepReviewedChange(source, 0)
    const rejectionTarget = getChangeRejectionTarget({
      fileDiff: source,
      fileKey: 'example.ts:change',
      filePath: 'example.ts',
      hunkIndex: 0,
    })

    expect(kept.additionLines.join('')).toBe('one\nTWO\nthree\n')
    expect(buildChangeReviewAnnotations('kept', kept)).toEqual([])
    expect(rejectionTarget).toEqual({
      kind: 'line-range',
      fileKey: 'example.ts:change',
      filePath: 'example.ts',
      start: { side: 'additions', lineNumber: 2 },
      end: { side: 'additions', lineNumber: 2 },
    })
    expect(source.hunks[0]?.additionLines).toBe(1)
    expect(source.hunks[0]?.deletionLines).toBe(1)
  })
})
