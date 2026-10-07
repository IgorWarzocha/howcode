import path from 'node:path'
import { createServerRuntime } from '../src/server/runtime'
import { startHeadlessServer } from '../src/server/server'
import { createServerShutdown } from '../src/server/shutdown'

const {
  HOWCODE_DEV_WEB_BRIDGE_HOST: host = '127.0.0.1',
  HOWCODE_DEV_WEB_BRIDGE_TOKEN: proxyToken,
} = process.env
if (!proxyToken) throw new Error('Missing dev:web proxy token.')
const runtime = createServerRuntime(path.resolve(process.cwd()))
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
    proxyToken,
    options: { host, port: 0, accessToken: null, authRequired: false },
  })
  console.log(`HOWCODE_DEV_WEB_BRIDGE_READY ${JSON.stringify({ host, port: server.port })}`)
  closeServer = server.close
  process.on('SIGINT', requestShutdown)
  process.on('SIGTERM', requestShutdown)
} catch (error) {
  await shutdown()
  throw error
}
