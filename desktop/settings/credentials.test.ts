import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileCredentialStore } from './credentials.ts'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-auth-'))
  directories.push(directory)
  const filePath = path.join(directory, 'auth.json')
  return { filePath, store: new FileCredentialStore(filePath) }
}

describe('persistent provider credentials', () => {
  it('serializes refresh writes across store instances without losing another provider', async () => {
    const { filePath, store } = await fixture()
    const other = new FileCredentialStore(filePath)
    await store.modify('a', async () => ({
      type: 'oauth',
      refresh: 'r',
      access: 'a',
      expires: 1,
      accountId: 'account',
    }))
    await Promise.all([
      store.modify('a', async (current) => {
        if (current?.type !== 'oauth') throw new Error('Missing OAuth token')
        return { ...current, expires: current.expires + 1 }
      }),
      other.modify('a', async (current) => {
        if (current?.type !== 'oauth') throw new Error('Missing OAuth token')
        return { ...current, expires: current.expires + 1 }
      }),
      other.modify('b', async () => ({ type: 'api_key', key: 'secret' })),
    ])
    expect(await store.read('a')).toMatchObject({ expires: 3, accountId: 'account' })
    expect(await store.read('b')).toEqual({ type: 'api_key', key: 'secret' })
    expect((await stat(filePath)).mode & 0o777).toBe(0o600)
    expect(await store.list()).toEqual([
      { providerId: 'a', type: 'oauth' },
      { providerId: 'b', type: 'api_key' },
    ])
  })

  it('preserves credentials after a failed refresh and releases the lock', async () => {
    const { filePath, store } = await fixture()
    await store.modify('a', async () => ({ type: 'api_key', key: 'original' }))
    const before = await readFile(filePath, 'utf8')
    await expect(
      store.modify('a', async () => {
        throw new Error('Refresh failed')
      }),
    ).rejects.toThrow('Refresh failed')
    expect(await readFile(filePath, 'utf8')).toBe(before)
    await store.delete('a')
    expect(await store.read('a')).toBeUndefined()
  })

  it('rejects corrupted auth without overwriting it', async () => {
    const { filePath, store } = await fixture()
    await writeFile(filePath, '{ broken')
    await expect(
      store.modify('a', async () => ({ type: 'api_key', key: 'replacement' })),
    ).rejects.toThrow()
    expect(await readFile(filePath, 'utf8')).toBe('{ broken')
  })
})
