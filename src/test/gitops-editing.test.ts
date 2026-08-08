import { parsePatchFiles } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'
import { hydrateDiffForEditing } from '../app/native/gitops/diff/use-diff-file-content'
import { getDiffEditButtonPresentation } from '../app/native/gitops/edit/diff-editing-model'

const changedPatch = `diff --git a/file.txt b/file.txt
index 1111111..2222222 100644
--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-before
+after`

const addedPatch = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/new.txt
@@ -0,0 +1 @@
+new`

function getFileDiff(patch: string) {
  const fileDiff = parsePatchFiles(patch)[0]?.files[0]
  if (!fileDiff) throw new Error('Expected parsed file diff.')
  return fileDiff
}

describe('GitOps editing model', () => {
  it('hydrates changed files but leaves already-complete added-file patches alone', () => {
    const changed = getFileDiff(changedPatch)
    hydrateDiffForEditing(changed, {
      oldFile: { name: 'file.txt', contents: 'before\n' },
      newFile: { name: 'file.txt', contents: 'after\n' },
    })
    expect(changed.isPartial).toBe(false)

    const added = getFileDiff(addedPatch)
    expect(() =>
      hydrateDiffForEditing(added, {
        oldFile: null,
        newFile: { name: 'new.txt', contents: 'new\n' },
      }),
    ).not.toThrow()
    expect(added.isPartial).toBe(true)
  })

  it('derives edit-button behavior from one explicit editing state', () => {
    expect(getDiffEditButtonPresentation({ kind: 'idle', error: null }, 'file')).toMatchObject({
      icon: 'edit',
      busyElsewhere: false,
    })
    expect(
      getDiffEditButtonPresentation(
        { kind: 'editing', fileKey: 'file', dirty: true, saving: false, error: null },
        'file',
      ),
    ).toMatchObject({ icon: 'save', label: 'Save file', active: true })
    expect(
      getDiffEditButtonPresentation(
        { kind: 'editing', fileKey: 'other', dirty: false, saving: false, error: null },
        'file',
      ),
    ).toMatchObject({ icon: 'edit', busyElsewhere: true })
  })
})
