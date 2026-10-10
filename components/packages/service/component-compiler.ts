import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { InstalledComponentSource } from '../../../shared/installed-component-contracts.ts'
import {
  componentModuleBridgeKey,
  componentSharedModules,
} from '../../../shared/installed-component-contracts.ts'

const requireFromHost = createRequire(import.meta.url)
const hostModulePattern = /^(react(?:-dom)?(?:\/.*)?|@howaboua\/howcode-sdk\/.*)$/
const relativeModulePattern = /^\./
const anyModulePattern = /.*/
const outputPattern = /\.(js|css)$/
const exportIdentifierPattern = /^[A-Za-z_$][\w$]*$/
const sdkDirectory = dirname(requireFromHost.resolve('@howaboua/howcode-sdk/plugins'))

/** A full component runs inside the host React tree, unlike standalone ui.tsx. */
export async function compileInstalledComponent(entry: string): Promise<InstalledComponentSource> {
  const { build } = await import('esbuild')
  const identities = new Map(
    componentSharedModules.map((name) => [requireFromHost.resolve(name), name]),
  )
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    outdir: 'component',
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    logLevel: 'silent',
    plugins: [
      {
        name: 'howcode-component-host-modules',
        setup(builder) {
          builder.onResolve({ filter: hostModulePattern }, (args) => {
            const resolved = requireFromHost.resolve(args.path)
            const shared = identities.get(resolved)
            if (shared) return { path: shared, namespace: 'howcode-host' }
            if (args.path.startsWith('react'))
              throw new Error(`Unsupported host React export: ${args.path}`)
            return { path: resolved }
          })
          // SDK internals may import context owners by relative path.
          builder.onResolve({ filter: relativeModulePattern }, (args) => {
            if (!args.importer.startsWith(`${sdkDirectory}/`)) return undefined
            const resolved = createRequire(`${args.resolveDir}/package.json`).resolve(args.path)
            const shared = identities.get(resolved)
            return shared ? { path: shared, namespace: 'howcode-host' } : undefined
          })
          builder.onLoad({ filter: anyModulePattern, namespace: 'howcode-host' }, async (args) => {
            const loaded: object = await import(requireFromHost.resolve(args.path))
            // Stock Node includes synthetic CJS names such as module.exports.
            const exports = Object.keys(loaded).filter(
              (name) => name !== 'default' && exportIdentifierPattern.test(name),
            )
            const source = `const module = globalThis[${JSON.stringify(componentModuleBridgeKey)}]?.[${JSON.stringify(args.path)}]; if (!module) throw new Error(${JSON.stringify(`Host component module unavailable: ${args.path}`)});\n`
            return {
              contents:
                source +
                exports
                  .map(
                    (name, index) =>
                      `const export${index} = module[${JSON.stringify(name)}]; export { export${index} as ${name} };`,
                  )
                  .join('\n') +
                (Object.hasOwn(loaded, 'default') ? '\nexport default module.default;' : ''),
              loader: 'js',
              resolveDir: dirname(entry),
            }
          })
        },
      },
    ],
  })
  const js = result.outputFiles.find((file) => file.path.endsWith('.js'))?.text
  if (!js) throw new Error('Component renderer compilation produced no JavaScript.')
  if (result.outputFiles.some((file) => !outputPattern.test(file.path)))
    throw new Error('Component renderer assets must be inline or owned by its public service.')
  return { js, css: result.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '' }
}
