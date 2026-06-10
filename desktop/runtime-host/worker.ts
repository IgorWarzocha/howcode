import { disposeAllRuntimeHosts, setRuntimeHostEventSink } from './host-service.ts'
import { handleMainResponse } from './main-request-client.ts'
import type { RuntimeMainToHostMessage } from './protocol.ts'
import { handleRuntimeHostRequest } from './request-handlers.ts'

setRuntimeHostEventSink((event) => {
  process.send?.({ type: 'desktop-event', event })
})

process.on('message', (message: RuntimeMainToHostMessage) => {
  if (message && message.type === 'main-response') {
    handleMainResponse(message)
    return
  }
  if (message?.type !== 'request') {
    return
  }

  void handleRuntimeHostRequest(message)
    .then((result) => {
      process.send?.({ type: 'response', id: message.id, ok: true, result })
    })
    .catch((error) => {
      process.send?.({
        type: 'response',
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    })
})

function reportFatalHostError(error: unknown) {
  process.send?.(
    {
      type: 'host-error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    () => {
      process.exit(1)
    },
  )
  setTimeout(() => process.exit(1), 100).unref()
}

process.on('uncaughtException', reportFatalHostError)

process.on('unhandledRejection', (error) => {
  process.send?.({
    type: 'host-error',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
})

let isShuttingDown = false

async function shutdownRuntimeHost() {
  if (isShuttingDown) return
  isShuttingDown = true
  try {
    await disposeAllRuntimeHosts()
  } finally {
    process.exit(0)
  }
}

process.once('disconnect', () => {
  void shutdownRuntimeHost()
})

process.once('SIGTERM', () => {
  void shutdownRuntimeHost()
})

process.once('SIGINT', () => {
  void shutdownRuntimeHost()
})
