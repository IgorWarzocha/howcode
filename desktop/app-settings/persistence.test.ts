import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'

async function openSettings() {
  vi.resetModules()
  const [{ loadAppSettings }, { setGitDiffBaselineDefault }, { disposeThreadStateDatabase }] =
    await Promise.all([
      import('./readers.ts'),
      import('./writers.ts'),
      import('../thread-state-db/db.ts'),
    ])
  return { loadAppSettings, setGitDiffBaselineDefault, dispose: disposeThreadStateDatabase }
}

it('persists explicit HEAD across reopening and restores the main-branch default on reset', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-settings-'))
  vi.stubEnv('HOWCODE_USER_DATA_PATH', directory)
  let settings: Awaited<ReturnType<typeof openSettings>> | undefined

  try {
    settings = await openSettings()
    expect(settings.loadAppSettings().gitDiffBaselineDefault).toEqual({ kind: 'main-branch' })
    settings.setGitDiffBaselineDefault({ kind: 'head' })
    expect(settings.loadAppSettings().gitDiffBaselineDefault).toEqual({ kind: 'head' })
    await settings.dispose()

    settings = await openSettings()
    expect(settings.loadAppSettings().gitDiffBaselineDefault).toEqual({ kind: 'head' })
    settings.setGitDiffBaselineDefault({ kind: 'main-branch' })
    await settings.dispose()

    settings = await openSettings()
    expect(settings.loadAppSettings().gitDiffBaselineDefault).toEqual({ kind: 'main-branch' })
  } finally {
    await settings?.dispose()
    vi.unstubAllEnvs()
    vi.resetModules()
    await rm(directory, { recursive: true, force: true })
  }
})
