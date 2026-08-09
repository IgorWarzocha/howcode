import { parseDiffFromFile, parsePatchFiles } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'
import type { ProjectFileWriteRequest } from '../app/desktop/types'
import {
  type DiffFileContentController,
  hydrateDiffForEditing,
} from '../app/native/gitops/diff/use-diff-file-content'
import {
  buildChangeReviewAnnotations,
  resolveReviewedChange,
} from '../app/native/gitops/review/change-review-model'
import {
  canUndoReviewedChange,
  undoReviewedChange,
} from '../app/native/gitops/review/undo-reviewed-change'

function createDiff(oldContents: string, newContents: string) {
  return parseDiffFromFile(
    { name: 'example.ts', contents: oldContents },
    { name: 'example.ts', contents: newContents },
  )
}

describe('GitOps Pierre change review', () => {
  it('anchors one canonical review action to each unresolved hunk', () => {
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

  it('uses Pierre to resolve a hunk without mutating its source diff', () => {
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

  it('writes an undone hunk through the revision-checked file boundary', async () => {
    const oldContents = Array.from({ length: 24 }, (_, index) => `line ${index + 1}\n`).join('')
    const newContents = oldContents
      .replace('line 2\n', 'TWO\n')
      .replace('line 23\n', 'TWENTY THREE\n')
    const source = createDiff(oldContents, newContents)
    const writes: ProjectFileWriteRequest[] = []
    const fileContent = {
      loadFiles: async () => {
        throw new Error('not used')
      },
      prepareWrite: async () => ({ path: 'example.ts', revision: 'sha256:current' }),
    } satisfies DiffFileContentController

    const result = await undoReviewedChange({
      fileActions: {
        write: async (request) => {
          writes.push(request)
          return {
            kind: 'written',
            file: { path: request.path, contents: request.contents, revision: 'sha256:next' },
          }
        },
      },
      fileContent,
      fileDiff: source,
      hunkIndex: 0,
      projectId: '/project',
    })

    expect(source.hunks).toHaveLength(2)
    expect(writes).toEqual([
      {
        projectId: '/project',
        path: 'example.ts',
        contents: oldContents.replace('line 23\n', 'TWENTY THREE\n'),
        expectedRevision: 'sha256:current',
      },
    ])
    expect(result.kind).toBe('undone')
  })

  it('reports revision conflicts and does not offer file-lifecycle undo', async () => {
    const source = createDiff('one\n', 'ONE\n')
    const result = await undoReviewedChange({
      fileActions: {
        write: async () => ({
          kind: 'conflict',
          path: 'example.ts',
          expectedRevision: 'sha256:current',
          currentRevision: 'sha256:newer',
        }),
      },
      fileContent: {
        loadFiles: async () => {
          throw new Error('not used')
        },
        prepareWrite: async () => ({ path: 'example.ts', revision: 'sha256:current' }),
      },
      fileDiff: source,
      hunkIndex: 0,
      projectId: '/project',
    })

    expect(result).toEqual({
      kind: 'failed',
      message: 'Could not undo example.ts because it changed outside Howcode.',
    })
    expect(canUndoReviewedChange({ ...source, type: 'new' })).toBe(false)
    expect(canUndoReviewedChange({ ...source, type: 'deleted' })).toBe(false)
  })

  it('hydrates omitted context before writing the complete undone file', async () => {
    const oldContents = Array.from({ length: 10 }, (_, index) => `line ${index + 1}\r\n`).join('')
    const newContents = oldContents.replace('line 5\r\n', 'FIVE\r\n')
    const patch = `diff --git a/example.ts b/example.ts
index 1111111..2222222 100644
--- a/example.ts
+++ b/example.ts
@@ -5 +5 @@
-line 5
+FIVE`
    const source = parsePatchFiles(patch)[0]?.files[0]
    if (!source) throw new Error('Expected a parsed partial diff.')
    let writtenContents = ''

    await undoReviewedChange({
      fileActions: {
        write: async (request) => {
          writtenContents = request.contents
          return {
            kind: 'written',
            file: { path: request.path, contents: request.contents, revision: 'sha256:next' },
          }
        },
      },
      fileContent: {
        loadFiles: async () => {
          throw new Error('not used')
        },
        prepareWrite: async (fileDiff) => {
          hydrateDiffForEditing(fileDiff, {
            oldFile: { name: 'example.ts', contents: oldContents },
            newFile: { name: 'example.ts', contents: newContents },
          })
          return { path: 'example.ts', revision: 'sha256:current' }
        },
      },
      fileDiff: source,
      hunkIndex: 0,
      projectId: '/project',
    })

    expect(source.isPartial).toBe(false)
    expect(writtenContents).toBe(oldContents)
  })
})
