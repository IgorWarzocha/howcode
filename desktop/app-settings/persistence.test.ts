import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { expect, it, vi } from 'vitest'
import { getSettingsToolkitComponents } from '../../shared/desktop-action-payloads.ts'
import { isToolkitComponentEnabled, toolkitComponents } from '../../shared/toolkit-components.ts'

async function openSettings() {
  vi.resetModules()
  const [
    { loadAppSettings },
    { setGitDiffBaselineDefault, setEnabledToolkitComponents },
    { disposeChatStateDatabase },
  ] = await Promise.all([
    import('./readers.ts'),
    import('./writers.ts'),
    import('../chat-repository/db.ts'),
  ])
  return {
    loadAppSettings,
    setGitDiffBaselineDefault,
    setEnabledToolkitComponents,
    dispose: disposeChatStateDatabase,
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

it('preserves legacy component choices and explicit empty selections across reopening', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-toolkit-settings-'))
  vi.stubEnv('HOWCODE_USER_DATA_PATH', directory)
  let settings: Awaited<ReturnType<typeof openSettings>> | undefined
  try {
    settings = await openSettings()
    const defaults = settings.loadAppSettings()
    expect(defaults.enabledToolkitComponents).toBeUndefined()
    expect(toolkitComponents.every(({ id }) => isToolkitComponentEnabled(defaults, id))).toBe(true)
    expect(() => getSettingsToolkitComponents({ value: ['unknown'] })).toThrow()
    expect(settings.loadAppSettings().enabledToolkitComponents).toBeUndefined()
    const { databaseOperation } = await import('../chat-repository/db.ts')
    databaseOperation(() =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        yield* sql.unsafe('INSERT INTO app_preferences (key, value_json) VALUES (?, ?)', [
          'enabledToolkitExtensions',
          JSON.stringify(['terminal']),
        ])
      }),
    )()
    await settings.dispose()
    settings = await openSettings()
    expect(settings.loadAppSettings().enabledToolkitComponents).toEqual(['terminal'])
    settings.setEnabledToolkitComponents(getSettingsToolkitComponents({ value: [] }))
    await settings.dispose()
    settings = await openSettings()
    const disabled = settings.loadAppSettings()
    expect(disabled.enabledToolkitComponents).toEqual([])
    expect(toolkitComponents.some(({ id }) => isToolkitComponentEnabled(disabled, id))).toBe(false)
  } finally {
    await settings?.dispose()
    vi.unstubAllEnvs()
    vi.resetModules()
    await rm(directory, { recursive: true, force: true })
  }
})
