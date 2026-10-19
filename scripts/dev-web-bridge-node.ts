import path from 'node:path'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { DevBridgeInspection, DevRuntimeActivity } from '../shared/dev-runtime'
import { createServerRuntime } from '../src/server/runtime'
import { startHeadlessServer } from '../src/server/server'
import { createServerShutdown } from '../src/server/shutdown'

const {
  HOWCODE_DEV_WEB_BRIDGE_HOST: host = '127.0.0.1',
  HOWCODE_DEV_WEB_BRIDGE_TOKEN: proxyToken,
  HOWCODE_DEV_WEB_ACCESS_TOKEN: accessToken,
  HOWCODE_BUILD_ROOT: buildRoot,
} = process.env
if (!proxyToken) throw new Error('Missing dev:web proxy token.')
const root = path.resolve(process.cwd())
const runtime = createServerRuntime(root, buildRoot || path.join(root, 'build'))
let closeServer = () => Promise.resolve()
const shutdown = await createServerShutdown({
  closeServer: () => closeServer(),
  disposeRuntime: runtime.dispose,
})
const requestShutdown = () => {
  void shutdown().finally(() => process.exit(0))
}
process.once('disconnect', requestShutdown)
process.on('SIGINT', requestShutdown)
process.on('SIGTERM', requestShutdown)
process.on('message', (message: unknown) => {
  const decoded = Schema.decodeUnknownResult(DevBridgeInspection)(message)
  if (Result.isFailure(decoded)) return
  const { id } = decoded.success
  void runtime.dev
    .inspectActivity()
    .then((activity) =>
      process.send?.({
        type: 'activity',
        id,
        activity: Schema.decodeUnknownSync(DevRuntimeActivity)(activity),
      }),
    )
    .catch((error: unknown) =>
      process.send?.({
        type: 'activity-error',
        id,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
})
try {
  const server = await startHeadlessServer({
    runtime,
    proxyToken,
    options: { host, port: 0, accessToken: accessToken ?? null, authRequired: false },
  })
  closeServer = server.close
  // Readiness includes the owning service, not just its lazy HTTP transport.
  await runtime.dev.inspectActivity()
  process.send?.({ type: 'ready', port: server.port })
} catch (error) {
  await shutdown()
  throw error
}
