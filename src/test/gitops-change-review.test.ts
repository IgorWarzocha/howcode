import { parseDiffFromFile } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'
import {
  buildChangeReviewAnnotations,
  resolveReviewedChange,
} from '../app/native/gitops/review/change-review-model'

function createDiff(oldContents: string, newContents: string) {
  return parseDiffFromFile(
    { name: 'example.ts', contents: oldContents },
    { name: 'example.ts', contents: newContents },
  )
}

describe('GitOps Pierre change review', () => {
  it('anchors one canonical Keep/Undo action to each unresolved hunk', () => {
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

  it('uses Pierre to keep or undo the displayed hunk without mutating its source diff', () => {
    const source = createDiff('one\ntwo\nthree\n', 'one\nTWO\nthree\n')

    const kept = resolveReviewedChange(source, 0, 'keep')
    const undone = resolveReviewedChange(source, 0, 'undo')

    expect(kept.additionLines.join('')).toBe('one\nTWO\nthree\n')
    expect(undone.additionLines.join('')).toBe('one\ntwo\nthree\n')
    expect(buildChangeReviewAnnotations('kept', kept)).toEqual([])
    expect(buildChangeReviewAnnotations('undone', undone)).toEqual([])
    expect(source.hunks[0]?.additionLines).toBe(1)
    expect(source.hunks[0]?.deletionLines).toBe(1)
  })
})
