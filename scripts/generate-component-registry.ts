import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  howcodeMetadata,
  linkedDurablePackages,
  publicEntrypoint,
  readPackageManifest,
  resolvePackageRoot,
} from '@howaboua/howcode-sdk/node/plugin-metadata'

const root = process.cwd()
const config: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
if (
  typeof config !== 'object' ||
  config === null ||
  !('howcodeComponents' in config) ||
  !Array.isArray(config.howcodeComponents) ||
  !config.howcodeComponents.every((name) => typeof name === 'string') ||
  new Set(config.howcodeComponents).size !== config.howcodeComponents.length
)
  throw new Error('package.json howcodeComponents must contain unique installed package names.')
const components = await Promise.all(
  config.howcodeComponents.map(async (name: string) => {
    const directory = await resolvePackageRoot(name, root)
    const manifest = await readPackageManifest(directory)
    if (manifest.name !== name)
      throw new Error(`Component identity differs from configured package ${name}`)
    const metadata = howcodeMetadata(manifest, directory)
    if (!metadata) throw new Error(`Missing howcode metadata: ${name}`)
    const durable = await linkedDurablePackages(directory)
    for (const subpath of [metadata.renderer, metadata.host, metadata.service])
      if (subpath) Bun.resolveSync(publicEntrypoint(name, subpath), root)
    return { name, metadata, durable }
  }),
)

for (const [kind, path, contract] of [
  [
    'renderer',
    'src/app/component-system/installed-renderers.generated.ts',
    'PluginRendererContribution',
  ],
  [
    'host',
    'src/desktop-host/desktop-requests/installed-hosts.generated.ts',
    'PluginHostContribution',
  ],
  ['service', 'desktop/plugins/installed-services.generated.ts', 'PluginServiceContribution'],
] as const) {
  const selected = components.filter((component) => component.metadata[kind])
  const imports = selected.map(
    (component, index) =>
      `import contribution${index} from ${JSON.stringify(publicEntrypoint(component.name, component.metadata[kind] ?? '.'))}`,
  )
  const entries = selected.map(
    (component, index) => `  ${JSON.stringify(component.name)}: contribution${index},`,
  )
  const output = `// Generated from installed package metadata by scripts/generate-component-registry.ts.\nimport type { ${contract} } from '@howaboua/howcode-sdk/plugins'\n${imports.join('\n')}\n\nexport const installed${kind[0]?.toUpperCase()}${kind.slice(1)}Contributions = {\n${entries.join('\n')}\n} satisfies Record<string, ${contract}>\n`
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), output)
}
const linked = new Map<string, string>()
for (const component of components)
  for (const dependency of component.durable) {
    const previous = linked.get(dependency.name)
    if (previous && previous !== dependency.root)
      throw new Error(`Multiple resolved identities for linked Durable package ${dependency.name}`)
    linked.set(dependency.name, dependency.root)
  }
const durableRegistryPath = join(root, 'desktop/durable-runtime/installed-durable.generated.ts')
await mkdir(dirname(durableRegistryPath), { recursive: true })
await writeFile(
  durableRegistryPath,
  `// Generated from installed Howcode metadata. Dependency roots are resolved at runtime.\nexport const installedHowcodePackages = ${JSON.stringify(
    components.map((component) => component.name),
    null,
    2,
  )} as const\n`,
)
await writeFile(
  join(root, 'src/installed-plugin-sources.generated.css'),
  `/* Generated from installed renderer package configuration. */\n${components
    .filter((component) => component.metadata.renderer)
    .map((component) => `@source "../node_modules/${component.name}";`)
    .join('\n')}\n`,
)
execFileSync(
  'bun',
  [
    'x',
    'biome',
    'check',
    '--write',
    'src/app/component-system/installed-renderers.generated.ts',
    'src/desktop-host/desktop-requests/installed-hosts.generated.ts',
    'desktop/plugins/installed-services.generated.ts',
    'desktop/durable-runtime/installed-durable.generated.ts',
    'src/installed-plugin-sources.generated.css',
  ],
  { cwd: root, stdio: 'inherit' },
)
