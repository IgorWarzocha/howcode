import { describe, expect, it } from 'vitest'
import {
  buildSessionTreeListFromPiTree,
  filterSessionTreeListRows,
} from '../../shared/session-tree'

describe('buildSessionTreeListFromPiTree', () => {
  it('flattens a branched tree and marks active path', () => {
    const list = buildSessionTreeListFromPiTree(
      [
        {
          entry: {
            id: 'u1',
            parentId: null,
            type: 'message',
            message: { role: 'user', content: [{ type: 'text', text: 'root' }] },
          },
          children: [
            {
              entry: {
                id: 'a1',
                parentId: 'u1',
                type: 'message',
                message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
              },
              children: [
                {
                  entry: {
                    id: 'u2',
                    parentId: 'a1',
                    type: 'message',
                    message: { role: 'user', content: [{ type: 'text', text: 'branch' }] },
                  },
                  children: [],
                },
              ],
            },
            {
              entry: {
                id: 'alt',
                parentId: 'u1',
                type: 'message',
                message: { role: 'assistant', content: [{ type: 'text', text: 'sibling' }] },
              },
              children: [],
            },
          ],
        },
      ],
      'u2',
    )

    expect(list.leafId).toBe('u2')
    const u2 = list.rows.find((row) => row.id === 'u2')
    const alt = list.rows.find((row) => row.id === 'alt')
    expect(u2?.isLeaf).toBe(true)
    expect(u2?.isOnActivePath).toBe(true)
    expect(alt?.isOnActivePath).toBe(false)
  })
})

describe('filterSessionTreeListRows', () => {
  it('keeps custom labels separate from generated branch summary labels', () => {
    const list = buildSessionTreeListFromPiTree(
      [
        {
          entry: {
            id: 'bs',
            parentId: null,
            type: 'branch_summary',
            summary: 'summary text',
          },
          label: 'branch name',
          children: [],
        },
      ],
      'bs',
    )

    expect(list.rows[0]).toMatchObject({
      id: 'bs',
      label: 'summary text',
      customLabel: 'branch name',
      kind: 'branch',
    })
    expect(filterSessionTreeListRows(list.rows, 'labeled-only', 'bs')).toHaveLength(1)
  })

  it('marks active path through omitted bookkeeping parents', () => {
    const list = buildSessionTreeListFromPiTree(
      [
        {
          entry: {
            id: 'u1',
            parentId: null,
            type: 'message',
            message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
          },
          children: [
            {
              entry: {
                id: 'mc',
                parentId: 'u1',
                type: 'model_change',
              },
              children: [
                {
                  entry: {
                    id: 'a1',
                    parentId: 'mc',
                    type: 'message',
                    message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      'a1',
    )
    expect(list.rows.map((row) => row.id)).toEqual(['u1', 'a1'])
    expect(list.rows.find((row) => row.id === 'u1')?.isOnActivePath).toBe(true)
    expect(list.rows.find((row) => row.id === 'a1')?.isOnActivePath).toBe(true)
  })

  it('active path includes ancestors before a branch summary leaf', () => {
    const list = buildSessionTreeListFromPiTree(
      [
        {
          entry: {
            id: 'u1',
            parentId: null,
            type: 'message',
            message: { role: 'user', content: [{ type: 'text', text: 'start' }] },
          },
          children: [
            {
              entry: {
                id: 'a1',
                parentId: 'u1',
                type: 'message',
                message: { role: 'assistant', content: [{ type: 'text', text: 'reply' }] },
              },
              children: [
                {
                  entry: {
                    id: 'bs',
                    parentId: 'a1',
                    type: 'branch_summary',
                    summary: 'abandoned work',
                  },
                  children: [
                    {
                      entry: {
                        id: 'u-new',
                        parentId: 'bs',
                        type: 'message',
                        message: { role: 'user', content: [{ type: 'text', text: 'after' }] },
                      },
                      children: [],
                    },
                  ],
                },
                {
                  entry: {
                    id: 'dead-tip',
                    parentId: 'a1',
                    type: 'message',
                    message: { role: 'assistant', content: [{ type: 'text', text: 'old branch' }] },
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      'u-new',
    )

    expect(list.rows.find((row) => row.id === 'u1')?.isOnActivePath).toBe(true)
    expect(list.rows.find((row) => row.id === 'a1')?.isOnActivePath).toBe(true)
    expect(list.rows.find((row) => row.id === 'bs')?.isOnActivePath).toBe(true)
    expect(list.rows.find((row) => row.id === 'u-new')?.isOnActivePath).toBe(true)
    expect(list.rows.find((row) => row.id === 'dead-tip')?.isOnActivePath).toBe(false)
  })

  it('omits bookkeeping entries from flattened tree', () => {
    const list = buildSessionTreeListFromPiTree(
      [
        {
          entry: {
            id: 'u1',
            parentId: null,
            type: 'message',
            message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
          },
          children: [
            {
              entry: {
                id: 'mc',
                parentId: 'u1',
                type: 'model_change',
              },
              children: [],
            },
          ],
        },
      ],
      'u1',
    )
    expect(list.rows.map((row) => row.id)).toEqual(['u1'])
  })

  it('no-tools removes tool rows', () => {
    const rows = [
      {
        id: 'u',
        parentId: null,
        depth: 0,
        label: 'u',
        kind: 'user' as const,
        isLeaf: false,
        isOnActivePath: true,
      },
      {
        id: 't',
        parentId: 'u',
        depth: 1,
        label: 'read',
        kind: 'tool' as const,
        isLeaf: true,
        isOnActivePath: true,
      },
    ]
    expect(filterSessionTreeListRows(rows, 'no-tools', 't').map((row) => row.id)).toEqual(['u'])
  })
})
