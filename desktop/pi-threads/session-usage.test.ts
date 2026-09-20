import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { readSessionUsage } from './session-usage.ts'

it('counts billable non-conversation entries without inventing assistant turns', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'howcode-usage-'))
  const sessionPath = path.join(directory, 'session.jsonl')
  const usage = {
    input: 2,
    output: 1,
    cacheRead: 4,
    cacheWrite: 3,
    totalTokens: 10,
    cost: { total: 0.25 },
  }
  try {
    await writeFile(
      sessionPath,
      `${[
        { type: 'message', message: { role: 'assistant', content: [], usage } },
        { type: 'message', message: { role: 'toolResult', content: [], usage } },
        { type: 'usage', kind: 'cache_warm', usage },
        { type: 'usage', kind: 'future-operation', usage },
        { type: 'compaction', usage },
        { type: 'branch_summary', usage },
        { type: 'custom', usage },
        { type: 'message', message: { role: 'user', usage } },
      ]
        .map((entry) => JSON.stringify(entry))
        .join('\n')}\n{incomplete\n`,
    )

    expect(await readSessionUsage(sessionPath)).toEqual({
      input: 12,
      output: 6,
      cacheRead: 24,
      cacheWrite: 18,
      totalTokens: 60,
      costTotal: 1.5,
      assistantTurnCount: 1,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
