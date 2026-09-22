import { watch } from 'node:fs'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import { expect, it, vi } from 'vitest'
import { makeSessionWatcher } from './session-watch.ts'

vi.mock('node:fs', { spy: true })
vi.mock('node:fs/promises', { spy: true })
vi.mock('./external-thread-publisher.ts', () => ({
  publishExternalThreadUpdate: vi.fn(),
  shouldSuppressExternalThreadUpdate: () => false,
}))
vi.mock('./thread-loader.ts', () => ({ loadThreadSnapshot: vi.fn() }))

it('cannot install a superseded watcher after its initial stat completes, and closes the active watcher', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'howcode-session-watch-'))
  const oldPath = path.join(directory, 'old.jsonl')
  const newPath = path.join(directory, 'new.jsonl')
  await fs.writeFile(oldPath, '')
  await fs.writeFile(newPath, '')
  const stats = await fs.stat(oldPath)
  const delayedStat = Promise.withResolvers<Awaited<ReturnType<typeof fs.stat>>>()
  vi.mocked(fs.stat).mockReturnValueOnce(delayedStat.promise)
  const scope = Scope.makeUnsafe()
  try {
    const setPath = Effect.runSync(Scope.provide(makeSessionWatcher(), scope))
    const oldSelection = setPath(oldPath)
    await setPath(newPath)
    const watcher = vi.mocked(watch).mock.results.at(-1)?.value
    if (!watcher) throw new Error('No active watcher was created.')
    const close = vi.spyOn(watcher, 'close')
    delayedStat.resolve(stats)
    await oldSelection
    expect(watch).toHaveBeenCalledTimes(1)
    await Effect.runPromise(Scope.close(scope, Exit.void))
    expect(close).toHaveBeenCalledTimes(1)
  } finally {
    delayedStat.resolve(stats)
    await Effect.runPromise(Scope.close(scope, Exit.void))
    await fs.rm(directory, { recursive: true, force: true })
  }
})
