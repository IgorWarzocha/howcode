import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import { TestClock } from 'effect/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeComposerAttachmentSearch } from './composer-attachment-search'

vi.mock('node:fs/promises', { spy: true })

describe('attachment search index retention', () => {
  let directory: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'howcode-search-'))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('shares a directory walk across concurrent queries and canonical root aliases', async () => {
    const root = path.join(directory, 'root')
    const alias = path.join(directory, 'alias')
    await fs.mkdir(root)
    await fs.writeFile(path.join(root, 'alpha.txt'), 'alpha')
    await fs.writeFile(path.join(root, 'beta.txt'), 'beta')
    await fs.symlink(root, alias, 'junction')
    const reads = vi.mocked(fs.readdir)

    await Effect.runPromise(
      Effect.gen(function* () {
        const search = yield* makeComposerAttachmentSearch
        const results = yield* Effect.all(
          Array.from({ length: 20 }, (_, index) =>
            search({ projectId: index % 2 ? alias : root, query: index % 2 ? 'alpha' : 'beta' }),
          ),
          { concurrency: 'unbounded' },
        )
        expect(results.map((entries) => entries.map((entry) => entry.name))).toEqual(
          Array.from({ length: 20 }, (_, index) => [index % 2 ? 'alpha.txt' : 'beta.txt']),
        )
        expect(reads.mock.calls.filter(([target]) => target === root)).toHaveLength(1)
      }),
    )
  })

  it('keeps the snapshot for 30 seconds, then discovers changed directory contents', async () => {
    await fs.writeFile(path.join(directory, 'old.txt'), 'old')
    await Effect.runPromise(
      Effect.gen(function* () {
        const search = yield* makeComposerAttachmentSearch
        yield* search({ projectId: directory })
        yield* Effect.promise(() => fs.writeFile(path.join(directory, 'new.txt'), 'new'))
        yield* TestClock.adjust('29 seconds')
        expect(yield* search({ projectId: directory, query: 'new' })).toEqual([])
        yield* TestClock.adjust('1 second')
        expect(
          (yield* search({ projectId: directory, query: 'new' })).map((entry) => entry.name),
        ).toEqual(['new.txt'])
      }).pipe(Effect.provide(TestClock.layer())),
    )
  })

  it('rebuilds an evicted root before its TTL instead of retaining unlimited project indexes', async () => {
    const roots = Array.from({ length: 9 }, (_, index) => path.join(directory, String(index)))
    await Promise.all(roots.map((root) => fs.mkdir(root)))
    const first = path.join(directory, '0')
    await Effect.runPromise(
      Effect.gen(function* () {
        const search = yield* makeComposerAttachmentSearch
        for (const root of roots) yield* search({ projectId: root })
        yield* Effect.promise(() => fs.writeFile(path.join(first, 'new.txt'), 'new'))
        expect((yield* search({ projectId: first })).map((entry) => entry.name)).toEqual([
          'new.txt',
        ])
      }).pipe(Effect.provide(TestClock.layer())),
    )
  })
})
