import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getHeadlessAccessUrl, parseHeadlessServerOptions } from './options'
import { createServerRuntime } from './runtime'
import { startHeadlessServer } from './server'
import { createServerShutdown } from './shutdown'

const { HOWCODE_REPO_ROOT: configuredRoot, HOWCODE_RENDERER_ROOT: rendererRoot } = process.env
const root = configuredRoot
  ? path.resolve(configuredRoot)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const buildRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const options = parseHeadlessServerOptions()
if (options.dataPath) {
  // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv requires index-signature access.
  process.env['HOWCODE_USER_DATA_PATH'] = path.resolve(options.dataPath)
}
const runtime = createServerRuntime(root, buildRoot, options)
let serverStartup: ReturnType<typeof startHeadlessServer> | undefined
let stopping = false
const shutdown = await createServerShutdown({
  closeServer: async () => {
    const server = await serverStartup?.catch(() => undefined)
    await server?.close()
  },
  disposeRuntime: runtime.dispose,
})
const requestShutdown = () => {
  stopping = true
  void shutdown().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('Howcode failed to shut down cleanly.', error)
      process.exit(1)
    },
  )
}
process.on('SIGINT', requestShutdown)
process.on('SIGTERM', requestShutdown)
try {
  await runtime.start()
  if (!stopping) {
    serverStartup = startHeadlessServer({
      runtime,
      options,
      rendererDistDirectory: rendererRoot ? path.resolve(rendererRoot) : path.join(root, 'dist'),
    })
    const server = await serverStartup
    if (!stopping) {
      console.log(`Howcode ${getHeadlessAccessUrl(options)}`)
      console.log(
        `Howcode MCP ${getHeadlessAccessUrl({ host: options.host, port: server.port })}/mcp`,
      )
      if (!options.authRequired) console.log(`MCP Authorization: Bearer ${options.accessToken}`)
    }
  }
} catch (error) {
  console.error('Howcode failed to start.', error)
  await shutdown()
  process.exitCode = 1
}
