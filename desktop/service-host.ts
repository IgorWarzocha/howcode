import * as piSkills from './pi-skills.ts'
import * as piThreads from './pi-threads.ts'
import * as skillCreator from './skill-creator-session.ts'
import * as terminalManager from './terminal/manager.ts'

type ServiceRequest = {
  type: 'request'
  id: string
  module: string
  method: string
  args: unknown[]
}

type ServiceResponse = {
  type: 'response'
  id: string
  ok: boolean
  result?: unknown
  error?: string
  stack?: string
}

const modules: Record<string, Record<string, unknown>> = {
  piThreads,
  piSkills,
  skillCreator,
  terminalManager,
}

piThreads.subscribeDesktopEvents((event) => {
  process.send?.({ type: 'desktop-event', event })
})

terminalManager.subscribeTerminalEvents((event) => {
  process.send?.({ type: 'terminal-event', event })
})

async function handleRequest(message: ServiceRequest): Promise<ServiceResponse> {
  try {
    const targetModule = modules[message.module]
    const target = targetModule?.[message.method]
    if (typeof target !== 'function') {
      throw new Error(`Unknown desktop service method: ${message.module}.${message.method}`)
    }

    const result = await target(...message.args)
    return { type: 'response', id: message.id, ok: true, result }
  } catch (error) {
    const stack = error instanceof Error ? error.stack : undefined
    return {
      type: 'response',
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...(stack ? { stack } : {}),
    }
  }
}

process.on('message', (message: ServiceRequest) => {
  if (!message || message.type !== 'request') return
  void handleRequest(message).then((response) => process.send?.(response))
})

async function shutdown() {
  await Promise.allSettled([
    piThreads.disposeDesktopRuntime?.(),
    terminalManager.closeAllTerminals?.(),
  ])
  process.exit(0)
}

process.once('disconnect', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
process.once('SIGINT', () => void shutdown())

process.send?.({ type: 'ready' })
