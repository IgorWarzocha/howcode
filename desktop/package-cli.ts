import { createPackageManager } from '../components/packages/service/index.ts'
import { getDurableHostVersion } from './durable-runtime/packages.ts'
import { getDesktopUserDataPath } from './user-data-path.ts'

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

switch (command) {
  case 'install': {
    if (!source) throw new Error('Usage: howcode install <npm:package|git:repository|directory>')
    const installed = await manager.install(source)
    console.log(`Installed ${installed.source}\n${installed.root}`)
    break
  }
  case 'remove':
    if (!source) throw new Error('Usage: howcode remove <source>')
    if (!(await manager.remove(source))) throw new Error(`Package is not installed: ${source}`)
    console.log(`Removed ${source}`)
    break
  case 'list':
    if (source) throw new Error('Usage: howcode list')
    for (const installed of await manager.list())
      console.log(`${installed.source}\n  ${installed.root}`)
    break
  case 'update':
    for (const installed of await manager.update(source)) console.log(`Updated ${installed.source}`)
    break
  default:
    throw new Error(`Unknown package command: ${command}`)
}
if (command !== 'list')
  console.log(
    'UI package changes publish live. Agent extensions load at the next conversation boundary. Default selections include installed extensions.',
  )
