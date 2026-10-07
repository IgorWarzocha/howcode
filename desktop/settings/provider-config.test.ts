import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createModels } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it } from 'vitest'
import { applyProviderConfiguration } from './provider-config.ts'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})
async function fixture(config: unknown) {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-provider-'))
  directories.push(directory)
  await writeFile(path.join(directory, 'models.json'), JSON.stringify(config))
  return directory
}

describe('provider configuration boundary', () => {
  it('preserves validated provider routing and model limits', async () => {
    const directory = await fixture({
      providers: {
        local: {
          baseUrl: 'http://127.0.0.1:1234/v1',
          api: 'openai-completions',
          apiKey: 'configured-key',
          models: [
            {
              id: 'small',
              contextWindow: 8192,
              maxTokens: 2048,
              input: ['text'],
              compat: { supportsDeveloperRole: false },
            },
          ],
        },
      },
    })
    const models = createModels()
    await applyProviderConfiguration(models, directory)
    expect(models.getModel('local', 'small')).toMatchObject({
      baseUrl: 'http://127.0.0.1:1234/v1',
      contextWindow: 8192,
      maxTokens: 2048,
      compat: { supportsDeveloperRole: false },
    })
    expect((await models.getAuth('local'))?.auth.apiKey).toBe('configured-key')
  })

  it('rejects malformed or unsupported configuration instead of silently ignoring it', async () => {
    const directory = await fixture({ providers: { local: { unknownPolicy: true } } })
    await expect(applyProviderConfiguration(createModels(), directory)).rejects.toThrow()
    await writeFile(
      path.join(directory, 'models.json'),
      JSON.stringify({
        providers: { local: { api: 'openai-completions', models: [{ id: 'small' }] } },
      }),
    )
    await expect(applyProviderConfiguration(createModels(), directory)).rejects.toThrow(
      'needs a baseUrl',
    )
  })
})
