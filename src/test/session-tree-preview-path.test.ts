import { buildPathEntriesToEntryId } from '@howcode/shared/session-tree-preview'
import { describe, expect, it } from 'vitest'

describe('buildPathEntriesToEntryId', () => {
  it('walks parentId chain including bookkeeping nodes', () => {
    const entries = [
      { id: 'root', type: 'message', parentId: null },
      { id: 'model', type: 'model_change', parentId: 'root' },
      { id: 'user', type: 'message', parentId: 'model' },
      { id: 'sibling', type: 'message', parentId: 'model' },
    ]
    const path = buildPathEntriesToEntryId(entries, 'user')
    expect(path?.map((e) => e.id)).toEqual(['root', 'model', 'user'])
  })

  it('returns null when target is missing', () => {
    expect(
      buildPathEntriesToEntryId([{ id: 'a', type: 'x', parentId: null }], 'missing'),
    ).toBeNull()
  })
})
