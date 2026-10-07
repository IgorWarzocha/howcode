import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { createModels } from '@earendil-works/pi-ai/models'
import { defineTask, Harness, MemoryStorage } from '@earendil-works/pi-durable'
import { describe, expect, it } from 'vitest'
import { createPackageManager } from '../../components/packages/service/index.ts'
import {
  createDesktopExtensionRegistry,
  defaultExtensionExclusions,
  resolveDesktopExtensions,
} from './extension-composition.ts'
import { liveModels } from './live-models.ts'
import { loadInstalledPackages } from './packages.ts'

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'howcode-package-lifecycle-'))
  const root = join(directory, 'tools')
  await mkdir(root)
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'tools', main: 'index.ts' }))
  await writeFile(
    join(root, 'index.ts'),
    "import { key } from './value.ts'; export default { name: 'fixture', sections: [{ key, render: async () => 'fixture' }] }",
  )
  await writeFile(join(root, 'value.ts'), "export const key = 'first'")
  const manager = createPackageManager({ directory, cwd: directory, hostVersion: '1.0.4' })
  await manager.install(root)
  const packages = await loadInstalledPackages({
    directory,
    cwd: directory,
    stateDirectory: join(directory, 'notebook'),
    environmentId: 'test',
  })
  return { directory, root, manager, packages }
}

describe('installed package generations', () => {
  it('retains a notebook adapter while its owned tasks are live and closes retired adapters only at shutdown', async () => {
    const { directory, root, manager, packages: initial } = await fixture()
    await initial.close()
    const log = join(directory, 'closed')
    await writeFile(log, '')
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: '@howaboua/pi-durable-notebook', main: 'index.ts' }),
    )
    await writeFile(
      join(root, 'index.ts'),
      `
      import { defineTask } from '@earendil-works/pi-durable'
      import { appendFile } from 'node:fs/promises'
      export const createNodeShellBackend = () => ({})
      export const createNotebookMode = () => ({
        extension: { name: 'fixture-notebook', tasks: [defineTask({ name: 'fixture.cell', version: 1,
          initial: () => ({ phase: 'run' }), phases: { run: async () => {} },
          abort: async (_task, runtime, context) => runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context)
        })] },
        bind() {}, close: () => appendFile(${JSON.stringify(log)}, 'closed\\n')
      })
    `,
    )
    await manager.update(root)
    const packages = await loadInstalledPackages({
      directory,
      cwd: directory,
      stateDirectory: join(directory, 'notebook'),
      environmentId: 'test',
    })
    const context = BACKGROUND_CONTEXT
    const registry = createDesktopExtensionRegistry(packages.extensions)
    const harness = await Harness.open(
      new MemoryStorage(),
      { models: createModels(), registry },
      context,
    )
    packages.bind(harness)
    try {
      const original = packages.extensions[0]
      const task = defineTask({
        name: 'fixture.cell',
        version: 1,
        initial: () => ({ phase: 'run' }),
        phases: {
          run: async () => {
            /* Remains pending until cancelled. */
          },
        },
        abort: async () => {
          /* The registered generation owns cancellation. */
        },
      })
      const conversation = await harness.root(context)
      const id = await conversation.commit(
        (tx) => tx.createTask(task, {}, { ownership: { kind: 'conversation' } }),
        context,
      )
      await manager.update(root)
      expect(await packages.refresh()).toBe(false)
      expect(packages.extensions[0]).toBe(original)
      await manager.remove(root)
      expect(await packages.refresh()).toBe(false)
      expect(packages.extensions[0]).toBe(original)
      expect(await readFile(log, 'utf8')).toBe('')
      await harness.abortTask(id, context)
      harness.resume()
      await harness.waitForTask(id, context)
      expect(await packages.refresh()).toBe(true)
      expect(packages.extensions).toEqual([])
      expect(await readFile(log, 'utf8')).toBe('')
    } finally {
      await packages.close()
      await harness.close(context)
      expect(await readFile(log, 'utf8')).toBe('closed\n')
      await rm(directory, { recursive: true, force: true })
    }
  })
  it('retains unchanged instances, invalidates transitive local imports only on update, and preserves the last good generation on failure', async () => {
    const { directory, root, manager, packages } = await fixture()
    try {
      const original = packages.extensions[0]
      await writeFile(join(root, 'value.ts'), "export const key = 'second'")
      expect(await packages.refresh()).toBe(false)
      expect(packages.extensions[0]).toBe(original)
      await manager.update(root)
      await packages.refresh()
      expect(packages.extensions[0]?.sections?.[0]?.key).toBe('second')
      const current = packages.extensions[0]
      await writeFile(join(root, 'index.ts'), 'throw new Error("broken package")')
      await manager.update(root)
      await expect(packages.refresh()).rejects.toThrow('broken package')
      expect(packages.extensions[0]).toBe(current)
      await writeFile(join(root, 'index.ts'), "export default {name:'howcode.chat'}")
      await manager.update(root)
      await expect(
        packages.refresh((installed) => {
          createDesktopExtensionRegistry(installed)
        }),
      ).rejects.toThrow('Duplicate')
      expect(packages.extensions[0]).toBe(current)
      await manager.remove(root)
      await packages.refresh()
      expect(packages.extensions).toEqual([])
      expect(await readFile(join(root, 'value.ts'), 'utf8')).toContain('second')
    } finally {
      await packages.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('adds packages to the same default conversation without widening explicit choices', async () => {
    const context = BACKGROUND_CONTEXT
    const registry = createDesktopExtensionRegistry()
    const harness = await Harness.open(
      new MemoryStorage(),
      { models: createModels(), registry },
      context,
    )
    try {
      const automatic = await harness.createConversation(
        {
          ownership: { kind: 'ownerless' },
          agent: { extensions: { remove: defaultExtensionExclusions({ composerMode: 'chat' }) } },
        },
        context,
      )
      const explicit = await harness.createConversation(
        {
          ownership: { kind: 'ownerless' },
          agent: resolveDesktopExtensions({ composerExtensions: [] }, registry),
        },
        context,
      )
      registry.install({ name: 'installed', tools: [] })
      expect((await automatic.agent(context)).extensions.map((item) => item.name)).toContain(
        'installed',
      )
      expect((await explicit.agent(context)).extensions).toEqual([])
    } finally {
      await harness.close(context)
    }
  })

  it('does not hide a reported hook failure behind captured model access', () => {
    const models = createModels()
    let failure: Error | undefined
    const guarded = liveModels(() => {
      if (failure) throw failure
      return models
    })
    expect(guarded.getModels()).toEqual([])
    failure = new Error('Reload failed')
    expect(() => guarded.getModel('provider', 'model')).toThrow('Reload failed')
    failure = undefined
    expect(guarded.getModels()).toEqual([])
  })
})
