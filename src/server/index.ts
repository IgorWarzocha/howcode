import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getHeadlessAccessUrl, parseHeadlessServerOptions } from './options'
import { createServerRuntime } from './runtime'
import { startHeadlessServer } from './server'
import { createServerShutdown } from './shutdown'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const buildRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { HOWCODE_RENDERER_ROOT: rendererRoot } = process.env
const options = parseHeadlessServerOptions()
if (options.dataPath) {
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv requires index-signature access.
  process.env['HOWCODE_USER_DATA_PATH'] = path.resolve(options.dataPath)
}
const runtime = createServerRuntime(root, buildRoot)
let closeServer = () => Promise.resolve()
const shutdown = await createServerShutdown({
  closeServer: () => closeServer(),
  disposeRuntime: runtime.dispose,
})
const requestShutdown = () => {
  void shutdown().finally(() => process.exit(0))
}
try {
  const server = await startHeadlessServer({
    runtime,
    options,
    rendererDistDirectory: rendererRoot ? path.resolve(rendererRoot) : path.join(root, 'dist'),
  })
  closeServer = server.close
  process.on('SIGINT', requestShutdown)
  process.on('SIGTERM', requestShutdown)
  console.log(`Howcode ${getHeadlessAccessUrl(options)}`)
} catch (error) {
  await shutdown()
  throw error
}
