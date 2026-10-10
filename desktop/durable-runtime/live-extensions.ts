import {
  defineExtension,
  GenerationTask,
  hook,
  type RegistryReader,
} from '@earendil-works/pi-durable'
import { installedPluginGeneration } from '../plugins/runtime.ts'
import { createDesktopExtensionRegistry } from './extension-composition.ts'
import { loadInstalledPackages, type PackageLoadOptions } from './packages.ts'

/** Live, atomically published package registry and generation-boundary failure policy. */
export async function openLiveExtensions(options: PackageLoadOptions) {
  const packages = await loadInstalledPackages(options)
  let failure: { error: unknown } | undefined
  try {
    const reload = defineExtension({
      name: 'howcode.package-reload',
      hooks: [
        hook(GenerationTask, {
          async afterTools() {
            // Durable reports hook exceptions instead of failing generation.
            // The live Models adapter also enforces this boundary's failure.
            await refresh()
          },
        }),
      ],
    })
    let current = createDesktopExtensionRegistry(packages.extensions, [reload])
    let pluginGeneration = installedPluginGeneration()
    const listeners = new Set<() => void>()
    const registry: RegistryReader = {
      snapshot: () => current.snapshot(),
      subscribe(listener) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    }
    async function refresh() {
      try {
        const packagesChanged = await packages.refresh((installed) => {
          const next = createDesktopExtensionRegistry(installed, [reload])
          current = next
          for (const listener of listeners) listener()
        })
        if (!packagesChanged && pluginGeneration !== installedPluginGeneration()) {
          current = createDesktopExtensionRegistry(packages.extensions, [reload])
          for (const listener of listeners) listener()
        }
        pluginGeneration = installedPluginGeneration()
        failure = undefined
      } catch (error) {
        failure = { error }
        throw error
      }
    }
    return {
      packages,
      registry,
      refresh,
      assertReady() {
        if (failure !== undefined) throw failure.error
      },
    }
  } catch (error) {
    await packages.close()
    throw error
  }
}
