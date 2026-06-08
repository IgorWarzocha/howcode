import { describe, expect, it } from 'vitest'
import {
  browsePreviewEntryIdAfterFocus,
  shouldRestoreAnchorWhenClosingTree,
} from '../app/composer/useComposerSessionTreeBrowse'

describe('composer session tree browse', () => {
  it('enters preview when focusing a non-anchor row', () => {
    expect(browsePreviewEntryIdAfterFocus('anchor', 'branch-a')).toBe('branch-a')
  })

  it('clears preview when focusing the anchor row', () => {
    expect(browsePreviewEntryIdAfterFocus('anchor', 'anchor')).toBeNull()
  })

  it('restores anchor on close only when preview was active', () => {
    expect(shouldRestoreAnchorWhenClosingTree('branch-a', 'anchor')).toBe(true)
    expect(shouldRestoreAnchorWhenClosingTree(null, 'anchor')).toBe(false)
    expect(shouldRestoreAnchorWhenClosingTree('branch-a', null)).toBe(false)
  })
})
