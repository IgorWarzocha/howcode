import { howcodeMetadata, readPackageManifest } from '@howaboua/howcode-sdk/node/plugin-metadata'
import {
  createPackageManager,
  type InstalledPackage,
  packageSourceId,
  parsePackageSource,
  waitComponentStatus,
} from '../components/packages/service/index.ts'
import type { InstalledComponentDescriptor } from '../shared/installed-component-contracts.ts'
import { getDurableHostVersion } from './durable-runtime/packages.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'

type ActivationOperation = 'install' | 'remove' | 'list'
function reportComponentStatus(
  descriptor: InstalledComponentDescriptor | undefined,
  operation: ActivationOperation,
) {
  if (descriptor?.status === 'error' && operation === 'list') {
    console.log(`Component ${descriptor.name} error: ${descriptor.error}`)
    return
  }
  if (descriptor?.status === 'error')
    throw new Error(`Package inventory committed; component activation failed: ${descriptor.error}`)
  if (descriptor?.status === 'pending')
    console.log(`Component ${descriptor.name} activation pending: ${descriptor.reason}`)
  else if (operation === 'remove')
    console.log('Profile component removed. Stored producer data is preserved.')
  else if (descriptor?.status === 'ready')
    console.log(
      `Component ${descriptor.name} ready.${descriptor.renderer ? ' Renderer available live.' : ''}`,
    )
  else
    throw new Error(
      'Package inventory committed, but the host did not publish this full component.',
    )
}

const args = process.argv.slice(2)
const dataPathIndex = args.indexOf('--data-path')
if (dataPathIndex !== -1) {
  const dataPath = args[dataPathIndex + 1]
  if (!dataPath || dataPath.startsWith('--')) throw new Error('--data-path requires a directory.')
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv requires index-signature access.
  process.env['HOWCODE_USER_DATA_PATH'] = dataPath
  args.splice(dataPathIndex, 2)
}
const [command, source, ...extra] = args
if (extra.length > 0 || !command)
  throw new Error('Usage: howcode install|remove|list|update [source]')
const manager = createPackageManager({
  directory: getDesktopUserDataPath(),
  cwd: process.cwd(),
  hostVersion: await getDurableHostVersion(),
})

async function reportActivation(
  installed: InstalledPackage,
  operation: ActivationOperation = 'install',
) {
  let manifest: Awaited<ReturnType<typeof readPackageManifest>>
  try {
    manifest = await readPackageManifest(installed.root)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      ['ENOENT', 'ENOTDIR'].includes(String(error.code))
    )
      return
    throw error
  }
  if (!howcodeMetadata(manifest, installed.root)) return
  const status = await waitComponentStatus(
    getDesktopUserDataPath(),
    installed.source,
    operation === 'remove' ? undefined : (installed.revision ?? 'unversioned'),
  )
  if (!status) {
    console.log(
      'Component activation pending: the running host has not acknowledged this inventory revision. It will activate when the host is available and idle.',
    )
    return
  }
  const id = packageSourceId(installed.source, process.cwd())
  const descriptor = status.components.find(
    (component) =>
      component.id === id &&
      (operation === 'remove' || component.revision === (installed.revision ?? 'unversioned')),
  )
  reportComponentStatus(descriptor, operation)
}

switch (command) {
  case 'install': {
    if (!source) throw new Error('Usage: howcode install <npm:package|git:repository|directory>')
    const installed = await manager.install(source)
    console.log(`Installed ${installed.source}\n${installed.root}`)
    await reportActivation(installed)
    break
  }
  case 'remove': {
    if (!source) throw new Error('Usage: howcode remove <source>')
    const identity = parsePackageSource(source, process.cwd()).identity
    const installed = (await manager.inventory()).find(
      (item) => parsePackageSource(item.source, process.cwd()).identity === identity,
    )
    if (!(await manager.remove(source))) throw new Error(`Package is not installed: ${source}`)
    console.log(`Removed ${source}`)
    if (installed) await reportActivation(installed, 'remove')
    break
  }
  case 'list': {
    if (source) throw new Error('Usage: howcode list')
    const installed = await manager.list()
    for (const item of installed) console.log(`${item.source}\n  ${item.root}`)
    await Promise.all(installed.map((item) => reportActivation(item, 'list')))
    break
  }
  case 'update': {
    const updated = await manager.update(source)
    for (const installed of updated) {
      console.log(`Updated ${installed.source}`)
    }
    await Promise.all(updated.map((installed) => reportActivation(installed)))
    break
  }
  default:
    throw new Error(`Unknown package command: ${command}`)
}
if (command !== 'list')
  console.log(
    'Standalone UI changes publish live. Full components activate when the host is available and agent work is idle. Agent extensions load at the next conversation boundary.',
  )
