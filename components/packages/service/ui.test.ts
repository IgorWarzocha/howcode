import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPackageManager } from './manager'
import { writePackageSettings } from './state'
import { createPackageUiService } from './ui'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'howcode-package-ui-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  const root = join(directory, 'ui-only')
  await mkdir(root)
  await writeFile(
    join(root, 'ui.tsx'),
    "export const mount = () => () => {}; export const value = 'first'",
  )
  await writeFile(
    join(root, 'ui-rpc.ts'),
    "export default (method, input) => method === 'echo' ? input : 'first'",
  )
  const manager = createPackageManager({ directory, cwd: directory })
  let invalidations = 0
  const component = await createPackageUiService(
    { directory, cwd: directory },
    () => invalidations++,
  )
  cleanups.push(component.dispose)
  return { directory, root, manager, component, invalidations: () => invalidations }
}

describe('package UI generations', () => {
  it('rejects unknown IDs and stale revisions rather than loading browser-selected filesystem paths', async () => {
    const { root, manager, component } = await fixture()
    await manager.install(root)
    const first = (await component.service.listPackageUis())[0]
    if (!first) throw new Error('Fixture package missing.')
    await expect(
      component.service.loadPackageUi({ id: root, revision: first.revision }),
    ).rejects.toThrow('no longer installed')
    await expect(
      component.service.invokePackageUiRpc({
        ...first,
        id: '../ui-rpc.ts',
        method: 'echo',
        input: null,
      }),
    ).rejects.toThrow('no longer installed')
    await manager.update(root)
    await expect(component.service.loadPackageUi(first)).rejects.toThrow('no longer installed')
    await expect(
      component.service.invokePackageUiRpc({ ...first, method: 'echo', input: null }),
    ).rejects.toThrow('no longer installed')
    const second = (await component.service.listPackageUis())[0]
    if (!second) throw new Error('Updated package missing.')
    await manager.remove(root)
    await expect(component.service.loadPackageUi(second)).rejects.toThrow('no longer installed')
    await expect(
      component.service.invokePackageUiRpc({ ...second, method: 'echo', input: null }),
    ).rejects.toThrow('no longer installed')
  })

  it('keeps local source and RPC immutable until explicit update and exposes a broken new generation without last-good fallback', async () => {
    const { root, manager, component } = await fixture()
    await manager.install(root)
    const first = (await component.service.listPackageUis())[0]
    if (!first) throw new Error('Fixture package missing.')
    const original = await component.service.loadPackageUi(first)
    await rm(join(root, 'ui.tsx'))
    expect(await component.service.loadPackageUi(first)).toEqual(original)
    await writeFile(
      join(root, 'ui.tsx'),
      "export const mount = () => () => {}; export const value = 'second'",
    )
    await writeFile(join(root, 'ui-rpc.ts'), "export default () => 'second'")
    expect(await component.service.loadPackageUi(first)).toEqual(original)
    expect(
      await component.service.invokePackageUiRpc({ ...first, method: 'value', input: null }),
    ).toBe('first')
    await manager.update(root)
    const second = (await component.service.listPackageUis())[0]
    if (!second) throw new Error('Updated package missing.')
    expect(second.id).toBe(first.id)
    expect(second.revision).not.toBe(first.revision)
    expect(
      await component.service.invokePackageUiRpc({ ...second, method: 'value', input: null }),
    ).toBe('second')
    await writeFile(join(root, 'ui.tsx'), 'export const mount = ???')
    await manager.update(root)
    const broken = (await component.service.listPackageUis())[0]
    if (!broken) throw new Error('Broken generation missing.')
    expect(broken.status).toBe('error')
    await expect(component.service.loadPackageUi(second)).rejects.toThrow('no longer installed')
    await expect(component.service.loadPackageUi(broken)).rejects.toThrow('Build failed')
  })

  it('observes atomic install, update and removal writes and closes its directory watcher', async () => {
    const { root, manager, component, invalidations } = await fixture()
    for (const mutate of [
      () => manager.install(root),
      () => manager.update(root),
      () => manager.remove(root),
    ]) {
      const before = invalidations()
      await mutate()
      await vi.waitFor(() => expect(invalidations()).toBeGreaterThan(before))
    }
    await component.dispose()
    const before = invalidations()
    await manager.install(root)
    await expect(component.service.listPackageUis()).rejects.toThrow('closed')
    // Read the committed setting as a barrier, not a guessed watcher delay.
    await readFile(join(root, '..', 'packages', 'settings.json'), 'utf8')
    expect(invalidations()).toBe(before)
  })

  it.each(['missing', 'invalid metadata'])(
    'retires removed RPC despite an unrelated package with %s',
    async (failure) => {
      const { directory, root, manager, component } = await fixture()
      const started = join(directory, 'started')
      const stopped = join(directory, 'stopped')
      await writeFile(
        join(root, 'ui-rpc.ts'),
        `
      import { writeFile } from 'node:fs/promises'
      export default async (_method, _input, { signal }) => {
        const stopped = new Promise(resolve => signal.addEventListener('abort', async () => {
          await writeFile(${JSON.stringify(stopped)}, 'stopped')
          resolve(null)
        }, { once: true }))
        await writeFile(${JSON.stringify(started)}, 'started')
        return stopped
      }
    `,
      )
      const broken = join(directory, 'broken')
      const healthy = join(directory, 'healthy')
      for (const path of [root, broken, healthy]) {
        await mkdir(path, { recursive: true })
        if (path !== root)
          await writeFile(join(path, 'ui.tsx'), 'export const mount = () => () => {}')
        await manager.install(path)
      }
      const catalog = await component.service.listPackageUis()
      const active = catalog.find((item) => item.name === root)
      const unaffected = catalog.find((item) => item.name === healthy)
      if (!(active && unaffected)) throw new Error('Fixture packages missing.')
      const source = await component.service.loadPackageUi(unaffected)
      const rejected = expect(
        component.service.invokePackageUiRpc({ ...active, method: 'wait', input: null }),
      ).rejects.toThrow()
      await vi.waitFor(async () => expect(await readFile(started, 'utf8')).toBe('started'))
      if (failure === 'missing') await rm(broken, { recursive: true })
      else await writeFile(join(broken, 'package.json'), '{invalid')
      await manager.remove(root)
      await vi.waitFor(async () => expect(await readFile(stopped, 'utf8')).toBe('stopped'))
      await rejected
      expect(await component.service.loadPackageUi(unaffected)).toEqual(source)
      expect(
        (await component.service.listPackageUis()).find((item) => item.name === broken)?.status,
      ).toBe('error')
      await expect(component.service.loadPackageUi(active)).rejects.toThrow('no longer installed')
    },
  )

  it('requires a persisted installation revision before serving legacy package UI', async () => {
    const { directory, root, manager, component } = await fixture()
    await writePackageSettings(join(directory, 'packages', 'settings.json'), [{ source: root }])
    const legacy = (await component.service.listPackageUis())[0]
    if (!legacy) throw new Error('Legacy package missing.')
    await expect(component.service.loadPackageUi(legacy)).rejects.toThrow('installation revision')
    await manager.update(root)
    await expect(component.service.loadPackageUi(legacy)).rejects.toThrow('no longer installed')
  })

  it('aborts and drains active browser RPC on retirement and rejects non-JSON results before IPC serialization', async () => {
    const { directory, root, manager, component } = await fixture()
    const started = join(directory, 'started')
    const stopped = join(directory, 'stopped')
    await writeFile(
      join(root, 'ui-rpc.ts'),
      `
      import { writeFile } from 'node:fs/promises'
      export default async (method, _input, context) => {
        if (method === 'invalid') return 1n
        const stopped = new Promise(resolve => context.signal.addEventListener('abort', async () => {
          await writeFile(${JSON.stringify(stopped)}, 'stopped')
          resolve(null)
        }, { once: true }))
        await writeFile(${JSON.stringify(started)}, 'started')
        return stopped
      }
    `,
    )
    await manager.install(root)
    const descriptor = (await component.service.listPackageUis())[0]
    if (!descriptor) throw new Error('Fixture package missing.')
    await expect(
      component.service.invokePackageUiRpc({ ...descriptor, method: 'invalid', input: null }),
    ).rejects.toThrow()
    const call = component.service.invokePackageUiRpc({
      ...descriptor,
      method: 'wait',
      input: null,
    })
    const rejected = expect(call).rejects.toThrow()
    await vi.waitFor(async () => expect(await readFile(started, 'utf8')).toBe('started'))
    await component.dispose()
    await rejected
    expect(await readFile(stopped, 'utf8')).toBe('stopped')
  })
})
