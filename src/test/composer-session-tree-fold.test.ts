import { describe, expect, it } from 'vitest'
import type { ComposerSessionTreeRow } from '../app/composer/composer-session-tree'
import {
  getVisibleSessionTreeRowIndices,
  rowHasChildren,
} from '../app/composer/composer-session-tree-fold'

const sampleRows: ComposerSessionTreeRow[] = [
  {
    id: 'a',
    parentId: null,
    depth: 0,
    label: 'root',
    kind: 'user',
    isLeaf: false,
    isOnActivePath: true,
  },
  {
    id: 'b',
    parentId: 'a',
    depth: 1,
    label: 'child',
    kind: 'assistant',
    isLeaf: false,
    isOnActivePath: true,
  },
  {
    id: 'c',
    parentId: 'b',
    depth: 2,
    label: 'leaf',
    kind: 'user',
    isLeaf: true,
    isOnActivePath: true,
  },
]

describe('composer-session-tree-fold', () => {
  it('detects rows with deeper following siblings', () => {
    expect(rowHasChildren(sampleRows, 0)).toBe(true)
    expect(rowHasChildren(sampleRows, 1)).toBe(true)
    expect(rowHasChildren(sampleRows, 2)).toBe(false)
  })

  it('hides descendants when parent is collapsed', () => {
    const collapsed = new Set(['a'])
    expect(getVisibleSessionTreeRowIndices(sampleRows, collapsed)).toEqual([0])
    const collapsedMid = new Set(['b'])
    expect(getVisibleSessionTreeRowIndices(sampleRows, collapsedMid)).toEqual([0, 1])
  })

  it('hides deeper descendants when filtered rows leave depth gaps', () => {
    const rootRow = sampleRows[0]
    const leafRow = sampleRows[2]
    if (!(rootRow && leafRow)) throw new Error('sample rows missing')
    const filteredRows: ComposerSessionTreeRow[] = [rootRow, leafRow]
    expect(getVisibleSessionTreeRowIndices(filteredRows, new Set(['a']))).toEqual([0])
  })
})
