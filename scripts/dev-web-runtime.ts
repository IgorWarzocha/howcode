import { type ChildProcess, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { desktopShutdownTimeouts } from '../shared/desktop-shutdown-deadlines'
import { DevBridgeMessage } from '../shared/dev-runtime'
import { DEV_SERVER_HOST } from '../shared/dev-server'

type BridgeMessage = typeof DevBridgeMessage.Type

function receiveBridgeMessage<T extends BridgeMessage>(
  child: ChildProcess,
  accept: (message: BridgeMessage) => message is T,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const finish = (error: Error | null, message?: T) => {
      clearTimeout(timer)
      child.off('message', onMessage)
      child.off('error', onError)
      child.off('exit', onExit)
      if (error) reject(error)
      else if (message) resolve(message)
    }
    const onError = (error: Error) => finish(error)
    const onExit = () => finish(new Error('dev:web bridge exited.'))
    const onMessage = (value: unknown) => {
      const decoded = Schema.decodeUnknownResult(DevBridgeMessage)(value)
      if (Result.isFailure(decoded)) {
        finish(new Error('Invalid dev:web bridge message.'))
      } else if (accept(decoded.success)) {
        finish(null, decoded.success)
      }
    }
    const timer = setTimeout(() => finish(new Error('dev:web bridge timed out.')), timeoutMs)
    child.on('message', onMessage)
    child.once('error', onError)
    child.once('exit', onExit)
  })
}

export function startDevWebBridge(input: {
  root: string
  buildRoot: string
  nodeExecutable: string
  userDataPath: string
  token: string
  onUnexpectedExit: (error: Error) => void
}) {
  const child = spawn(input.nodeExecutable, [path.join(input.buildRoot, 'dev-web-bridge.mjs')], {
    cwd: input.root,
    env: {
      ...process.env,
      HOWCODE_REPO_ROOT: input.root,
      HOWCODE_BUILD_ROOT: input.buildRoot,
      HOWCODE_USER_DATA_PATH: input.userDataPath,
      HOWCODE_DEV_RUNTIME: '1',
      HOWCODE_DEV_WEB_BRIDGE_HOST: DEV_SERVER_HOST,
      HOWCODE_DEV_WEB_BRIDGE_TOKEN: input.token,
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })
  let stopping: Promise<void> | undefined
  let port: number | null = null
  child.on('error', (error) => {
    if (!stopping && port !== null) input.onUnexpectedExit(error)
  })
  child.once('exit', (code, signal) => {
    const wasReady = port !== null
    port = null
    if (!stopping && wasReady) {
      input.onUnexpectedExit(new Error(`dev:web bridge exited (code=${code}, signal=${signal}).`))
    }
  })
  const ready = receiveBridgeMessage(
    child,
    (message): message is Extract<BridgeMessage, { type: 'ready' }> => message.type === 'ready',
    30_000,
  ).then((message) => {
    port = message.port
  })

  function close() {
    stopping ??= new Promise<void>((resolve, reject) => {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) {
        resolve()
        return
      }
      const killTimer = setTimeout(
        () => child.kill('SIGKILL'),
        desktopShutdownTimeouts.serverCleanupMs + 1_000,
      )
      const deadline = setTimeout(() => {
        child.off('exit', onExit)
        reject(new Error('dev:web bridge did not exit after SIGKILL.'))
      }, desktopShutdownTimeouts.serverCleanupMs + 3_000)
      const onExit = () => {
        clearTimeout(killTimer)
        clearTimeout(deadline)
        resolve()
      }
      child.once('exit', onExit)
      child.kill('SIGTERM')
    })
    return stopping
  }

  return {
    ready,
    get port() {
      return port
    },
    close,
    kill: () => child.kill('SIGKILL'),
    async inspectActivity() {
      if (port === null || stopping || !child.connected)
        throw new Error('dev:web bridge is unavailable.')
      const id = crypto.randomUUID()
      const response = receiveBridgeMessage(
        child,
        (message): message is Exclude<BridgeMessage, { type: 'ready' }> =>
          message.type !== 'ready' && message.id === id,
        5_000,
      )
      child.send({ type: 'inspect-activity', id }, (error) => {
        if (error) child.emit('error', error)
      })
      const reply = await response
      if (reply.type === 'activity-error') throw new Error(reply.error)
      return reply.activity
    },
  }
}
