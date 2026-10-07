import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPackageManager } from './index'
import { parsePackageSource } from './source'

const directories: string[] = []
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'howcode-packages-'))
  directories.push(directory)
  const cwd = join(directory, 'workspace')
  await mkdir(cwd)
  const manager = createPackageManager({ directory, cwd, hostVersion: '1.0.4' })
  return { directory, cwd, manager }
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('package sources', () => {
  it('normalizes identity independently of versions and git refs', () => {
    expect(parsePackageSource('npm:@example/tools@1.2.3', '/work').identity).toBe(
      'npm:@example/tools',
    )
    const git = parsePackageSource('git:github.com/example/tools@feature/tool', '/work')
    expect(git).toMatchObject({
      kind: 'git',
      url: 'https://github.com/example/tools',
      ref: 'feature/tool',
    })
    expect(parsePackageSource('https://github.com/example/tools.git', '/work').identity).toBe(
      git.identity,
    )
    expect(parsePackageSource('./tools', '/work').identity).toBe('/work/tools')
  })
  it.each([
    '',
    ' npm:tools',
    'npm:',
    'npm:@tools',
    'npm:tools@file:../other',
    'git:github.com/example/tools@',
    'git:github.com/example/tools@--orphan',
    'https://user:password@github.com/example/tools',
    'http://example.com/tools',
    'ftp:tools',
  ])('rejects ambiguous or unsafe source %s', (source) => {
    expect(() => parsePackageSource(source, '/work')).toThrow()
  })
})

describe('package persistence', () => {
  it('rejects managed installs before cloning when Bun is unavailable', async () => {
    const { directory, manager } = await fixture()
    vi.stubEnv('PATH', '')
    try {
      await expect(manager.install('git:github.com/example/tools')).rejects.toThrow(
        'Bun is required',
      )
      await expect(manager.install('npm:tools')).rejects.toThrow('Bun is required')
      expect(await manager.list()).toEqual([])
      expect(await readdir(join(directory, 'packages'))).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('preserves local extension files and checks their parent manifest peer range', async () => {
    const { cwd, manager } = await fixture()
    const root = join(cwd, 'extension.ts')
    const contents = 'export default function extension() {}\n'
    await writeFile(root, contents)
    expect((await manager.install('./extension.ts')).root).toBe(root)
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ peerDependencies: { '@earendil-works/pi-durable': '^2.0.0' } }),
    )
    await expect(manager.update('./extension.ts')).rejects.toThrow('host is 1.0.4')
    await manager.remove('./extension.ts')
    expect(await readFile(root, 'utf8')).toBe(contents)
  })
  it('leaves manifest-free local resource directories untouched through update and removal', async () => {
    const { cwd, manager } = await fixture()
    const root = join(cwd, 'resources')
    await mkdir(root)
    await writeFile(join(root, 'skill.md'), 'Local resource contents\n')
    await manager.install('./resources')
    expect((await manager.update('./resources'))[0]?.root).toBe(root)
    await manager.remove('./resources')
    expect(await readdir(root)).toEqual(['skill.md'])
    expect(await readFile(join(root, 'skill.md'), 'utf8')).toBe('Local resource contents\n')
  })
  it('serializes managers sharing app data and persists absolute untouched local roots', async () => {
    const { directory, cwd, manager } = await fixture()
    for (const name of ['one', 'two']) {
      await mkdir(join(cwd, name))
      await writeFile(
        join(cwd, name, 'package.json'),
        JSON.stringify({ name, peerDependencies: { '@earendil-works/pi-durable': '^1.0.0' } }),
      )
    }
    const other = createPackageManager({ directory, cwd, hostVersion: '1.0.4' })
    await Promise.all([manager.install('./one'), other.install('./two')])
    const restarted = createPackageManager({ directory, cwd: tmpdir(), hostVersion: '1.0.4' })
    expect((await restarted.list()).map((item) => item.root).sort()).toEqual([
      join(cwd, 'one'),
      join(cwd, 'two'),
    ])
    expect(await restarted.remove(join(cwd, 'one'))).toBe(true)
    expect(await restarted.remove(join(cwd, 'one'))).toBe(false)
    expect(await readdir(join(cwd, 'one'))).toEqual(['package.json'])
    expect((await other.list()).map((item) => item.name)).toEqual(['two'])
  })
  it('does not persist failed installs and preserves settings after incompatible updates', async () => {
    const { directory, cwd, manager } = await fixture()
    await expect(manager.install('./missing')).rejects.toThrow()
    expect(await manager.list()).toEqual([])
    await mkdir(join(cwd, 'tools'))
    const manifest = join(cwd, 'tools', 'package.json')
    await writeFile(manifest, '{}')
    await manager.install('./tools')
    const settings = join(directory, 'packages', 'settings.json')
    const before = await readFile(settings, 'utf8')
    await writeFile(
      manifest,
      JSON.stringify({ peerDependencies: { '@earendil-works/pi-durable': '^2.0.0' } }),
    )
    await expect(manager.update('./tools')).rejects.toThrow('host is 1.0.4')
    expect(await readFile(settings, 'utf8')).toBe(before)
    await expect(manager.update('./uninstalled')).rejects.toThrow('not installed')
    await writeFile(manifest, '{}')
    await manager.install('./tools')
    expect(await manager.list()).toHaveLength(1)
  })
  it('rejects corrupted settings rather than overwriting them', async () => {
    const { directory, manager } = await fixture()
    const settings = join(directory, 'packages', 'settings.json')
    await mkdir(join(directory, 'packages'))
    const corrupted = JSON.stringify([{ source: 'npm:tools', location: '../../outside' }])
    await writeFile(settings, corrupted)
    await expect(manager.install('./tools')).rejects.toThrow('Invalid package settings')
    expect(await readFile(settings, 'utf8')).toBe(corrupted)
  })
})
