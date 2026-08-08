import { describe, expect, it } from 'vitest'
import type { ToolResultMessage } from '../app/thread/tool-diff'
import { getToolDiffSummary, getToolDiffs } from '../app/thread/tool-diff'

function applyPatch(rawArgs: unknown): ToolResultMessage {
  return {
    id: 'tool',
    role: 'toolResult',
    toolName: 'apply_patch',
    content: [],
    isError: false,
    rawArgs,
  }
}

describe('thread tool diff extraction', () => {
  it('extracts multiple apply_patch operations and counts changed lines', () => {
    const message = applyPatch({
      input: [
        '*** Begin Patch',
        '*** Update File: src/a.ts',
        '@@',
        '-old',
        '+new',
        '*** Add File: src/b.ts',
        '+added',
        '*** End Patch',
      ].join('\n'),
    })

    expect(getToolDiffs(message)).toEqual([
      { path: 'src/a.ts', status: 'M', diff: '@@\n-old\n+new' },
      { path: 'src/b.ts', status: 'A', diff: '+added' },
    ])
    expect(getToolDiffSummary(message)).toEqual({ added: 2, removed: 1 })
  })

  it('prefers structured backend diffs over tool argument parsing', () => {
    const message = {
      ...applyPatch({ patch: '*** Add File: ignored.ts\n+ignored\n*** End Patch' }),
      details: {
        fileDiffs: [{ path: 'real.ts', status: 'M', diff: '-before\n+after' }],
      },
    }

    expect(getToolDiffs(message)).toEqual([
      { path: 'real.ts', status: 'M', diff: '-before\n+after' },
    ])
  })
})
