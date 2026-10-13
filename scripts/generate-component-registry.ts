import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
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
const names = await Promise.all(
  config.howcodeComponents.map(async (name: string) => {
    const directory = await resolvePackageRoot(name, root)
    const manifest = await readPackageManifest(directory)
    if (manifest.name !== name)
      throw new Error(`Component identity differs from configured package ${name}`)
    const metadata = howcodeMetadata(manifest, directory)
    if (!metadata) throw new Error(`Missing howcode metadata: ${name}`)
    await linkedDurablePackages(directory)
    for (const subpath of [metadata.renderer, metadata.host, metadata.service])
      if (subpath) Bun.resolveSync(publicEntrypoint(name, subpath), root)
    return name
  }),
)
const defaultsPath = 'components/packages/service/default-packages.generated.ts'
await writeFile(
  join(root, defaultsPath),
  `// Generated distribution defaults; activation belongs to the profile package inventory.\nexport const defaultComponentPackages = ${JSON.stringify(names, null, 2)} as const\n`,
)
execFileSync('bun', ['x', 'biome', 'check', '--write', defaultsPath], {
  cwd: root,
  stdio: 'inherit',
})
