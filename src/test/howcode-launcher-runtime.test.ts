import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startRunningVersionLease } from '../electron/main/updater/update-active-lease'

const require = createRequire(import.meta.url)
const { withUpdateLock } = require('../../packages/howcode/lib/lock.js') as {
  withUpdateLock<T>(
    cacheRoot: string,
    operation: () => Promise<T>,
    options?: { attempts?: number; heartbeatMs?: number; retryMs?: number; staleMs?: number },
  ): Promise<T>
}
const { launch } = require('../../packages/howcode/lib/process-launcher.js') as {
  launch(
    executablePath: string,
    args: string[],
    options: { cacheRoot: string; readyTimeoutMs?: number },
  ): Promise<void>
}
const { getActiveVersionDirs } = require('../../packages/howcode/lib/active-versions.js') as {
  getActiveVersionDirs(cacheRoot: string, versionsRoot: string): Promise<Set<string>>
}

const temporaryDirectories: string[] = []

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-launcher-test-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('howcode launcher runtime', () => {
  it('does not release a replacement lock owned by another process', async () => {
    const cacheRoot = await createTemporaryDirectory()
    const lockPath = path.join(cacheRoot, '.update.lock')

    await withUpdateLock(cacheRoot, async () => {
      await rm(lockPath, { recursive: true, force: true })
      await mkdir(lockPath)
      await writeFile(path.join(lockPath, 'owner.json'), JSON.stringify({ token: 'replacement' }))
    })

    expect(JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8'))).toEqual({
      token: 'replacement',
    })
  })

  it('shares running-version leases across the Electron and launcher runtimes', async () => {
    const cacheRoot = await createTemporaryDirectory()
    const versionsRoot = path.join(cacheRoot, 'versions')
    const versionDir = path.join(versionsRoot, 'main-1.2.3-test')
    await mkdir(versionDir, { recursive: true })

    const stopLease = await startRunningVersionLease(cacheRoot, versionDir)
    expect(await getActiveVersionDirs(cacheRoot, versionsRoot)).toEqual(new Set([versionDir]))

    stopLease()
    expect(await getActiveVersionDirs(cacheRoot, versionsRoot)).toEqual(new Set())
    await expect(access(versionDir)).resolves.toBeUndefined()
  })

  it('waits for the desktop process to report ready', async () => {
    const cacheRoot = await createTemporaryDirectory()
    const readyScript = path.join(cacheRoot, 'ready.cjs')
    await writeFile(
      readyScript,
      "require('node:fs').writeFileSync(process.env.HOWCODE_LAUNCH_READY_FILE, 'ready')",
    )

    await expect(
      launch(process.execPath, [readyScript], { cacheRoot, readyTimeoutMs: 5_000 }),
    ).resolves.toBeUndefined()
  })

  it('reports a desktop process that never becomes ready', async () => {
    const cacheRoot = await createTemporaryDirectory()
    const silentScript = path.join(cacheRoot, 'silent.cjs')
    await writeFile(silentScript, '')

    await expect(
      launch(process.execPath, [silentScript], { cacheRoot, readyTimeoutMs: 200 }),
    ).rejects.toThrow('did not report ready')
  })
})
