import { describe, expect, it } from 'vitest'
import type { ComposerSessionTreeRow } from '../app/composer/composer-session-tree'
import { filterSessionTreeRows } from '../app/composer/composer-session-tree-filter'

const rows: ComposerSessionTreeRow[] = [
  { id: 'u', depth: 0, label: 'hi', kind: 'user', isLeaf: false, isOnActivePath: true },
  { id: 'a', depth: 1, label: 'ok', kind: 'assistant', isLeaf: false, isOnActivePath: true },
  { id: 't', depth: 2, label: 'read', kind: 'tool', isLeaf: false, isOnActivePath: true },
  { id: 's', depth: 1, label: 'sum', kind: 'summary', isLeaf: true, isOnActivePath: true },
]

describe('filterSessionTreeRows', () => {
  it('no-tools drops tool rows', () => {
    expect(filterSessionTreeRows(rows, 'no-tools').map((row) => row.id)).toEqual(['u', 'a', 's'])
  })

  it('user-only keeps user rows', () => {
    expect(filterSessionTreeRows(rows, 'user-only').map((row) => row.id)).toEqual(['u'])
  })
})
