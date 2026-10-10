import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, sep } from 'node:path'
import { publicEntrypoint } from '@howaboua/howcode-sdk/node/plugin-metadata'
import type {
  PluginHostContribution,
  PluginServiceContribution,
} from '@howaboua/howcode-sdk/plugins'
import { createJiti } from 'jiti'

export type InstalledComponentDefinition = {
  id: string
  name: string
  revision: string
  service?: PluginServiceContribution
  host?: PluginHostContribution
}

/** Resolve the installed package's declared public exports, not its private source. */
export function componentEntrypoint(root: string, name: string, subpath: string) {
  const entry = createRequire(join(root, 'package.json')).resolve(publicEntrypoint(name, subpath))
  const path = relative(realpathSync(root), realpathSync(entry))
  if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`))
    throw new Error(
      `Component public export resolves outside its installed package: ${name}${subpath}`,
    )
  return entry
}

export async function loadComponentContribution<
  T extends PluginHostContribution | PluginServiceContribution,
>(entry: string): Promise<T> {
  const { build } = await import('esbuild')
  // Snapshot the component's relative module graph. Jiti's async import can use
  // Node's ESM cache even with moduleCache disabled, which is not a generation.
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    packages: 'external',
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
  })
  if (bundle.outputFiles.length !== 1 || !bundle.outputFiles[0])
    throw new Error(`Component server export must compile into one module: ${entry}`)
  const loader = createJiti(import.meta.url, {
    interopDefault: false,
    tryNative: false,
    moduleCache: false,
    fsCache: false,
  })
  const value: unknown = await loader.evalModule(bundle.outputFiles[0].text, {
    filename: entry,
    async: true,
    forceTranspile: true,
  })
  if (!value || typeof value !== 'object')
    throw new Error(`Invalid component server module: ${entry}`)
  const module = value as { default?: unknown }
  const contribution = module.default
  if (
    !contribution ||
    typeof contribution !== 'object' ||
    !('create' in contribution) ||
    typeof contribution.create !== 'function'
  )
    throw new Error(
      `Component public export must provide a default contribution with create(): ${entry}`,
    )
  return contribution as T
}
