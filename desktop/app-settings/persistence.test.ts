import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { getSettingsToolkitExtensions } from '../../shared/pi-thread-action-payloads.ts'
import { isToolkitExtensionEnabled, toolkitExtensions } from '../../shared/toolkit-extensions.ts'

async function openSettings() {
  vi.resetModules()
  const [
    { loadAppSettings },
    { setGitDiffBaselineDefault, setEnabledToolkitExtensions },
    { disposeThreadStateDatabase },
  ] = await Promise.all([
    import('./readers.ts'),
    import('./writers.ts'),
    import('../thread-state-db/db.ts'),
  ])
  return {
    loadAppSettings,
    setGitDiffBaselineDefault,
    setEnabledToolkitExtensions,
    dispose: disposeThreadStateDatabase,
  }
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

it('preserves an explicit empty toolkit selection across reopening and rejects unknown IDs at ingress', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-toolkit-settings-'))
  vi.stubEnv('HOWCODE_USER_DATA_PATH', directory)
  let settings: Awaited<ReturnType<typeof openSettings>> | undefined
  try {
    settings = await openSettings()
    const defaults = settings.loadAppSettings()
    expect(defaults.enabledToolkitExtensions).toBeUndefined()
    expect(toolkitExtensions.every(({ id }) => isToolkitExtensionEnabled(defaults, id))).toBe(true)
    expect(() => getSettingsToolkitExtensions({ value: ['unknown'] })).toThrow()
    expect(settings.loadAppSettings().enabledToolkitExtensions).toBeUndefined()
    settings.setEnabledToolkitExtensions(getSettingsToolkitExtensions({ value: [] }))
    await settings.dispose()
    settings = await openSettings()
    const disabled = settings.loadAppSettings()
    expect(disabled.enabledToolkitExtensions).toEqual([])
    expect(toolkitExtensions.some(({ id }) => isToolkitExtensionEnabled(disabled, id))).toBe(false)
  } finally {
    await settings?.dispose()
    vi.unstubAllEnvs()
    vi.resetModules()
    await rm(directory, { recursive: true, force: true })
  }
})
