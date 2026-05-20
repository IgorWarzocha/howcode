import { randomUUID } from 'node:crypto'
import type {
  RuntimeHostMainRequestMap,
  RuntimeHostMainRequestName,
  RuntimeHostMainResponseMap,
  RuntimeHostMainResponseMessage,
} from './protocol.ts'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

async function invokeLocalMainRequest<TName extends RuntimeHostMainRequestName>(
  name: TName,
  payload: RuntimeHostMainRequestMap[TName],
): Promise<RuntimeHostMainResponseMap[TName]> {
  const { handleRuntimeHostMainRequest } = await import('./main-request-handlers.ts')
  return handleRuntimeHostMainRequest({
    type: 'main-request',
    id: 'local',
    name,
    payload,
  })
}

const mainRequestTimeoutMs = 30_000

const pendingMainRequests = new Map<
  string,
  {
    resolve: (value: RuntimeHostMainResponseMap[RuntimeHostMainRequestName]) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }
>()

export function handleMainResponse(message: RuntimeHostMainResponseMessage) {
  const pending = pendingMainRequests.get(message.id)
  if (!pending) return
  pendingMainRequests.delete(message.id)
  clearTimeout(pending.timeout)
  if (message.ok) {
    pending.resolve(message.result)
    return
  }
  const error = new Error(message.error)
  if (message.stack) error.stack = message.stack
  pending.reject(error)
}

export async function invokeMainRequest<TName extends RuntimeHostMainRequestName>(
  name: TName,
  payload: RuntimeHostMainRequestMap[TName],
): Promise<RuntimeHostMainResponseMap[TName]> {
  if (getProcessEnvironmentVariable('HOWCODE_HANDLE_MAIN_REQUESTS_IN_HOST') === '1') {
    return await invokeLocalMainRequest(name, payload)
  }

  if (!process.send) {
    throw new Error(`Cannot invoke main request ${name}: runtime host IPC is unavailable.`)
  }

  const id = randomUUID()
  const result = new Promise<RuntimeHostMainResponseMap[TName]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingMainRequests.delete(id)
      reject(new Error(`Timed out waiting for main request ${name}.`))
    }, mainRequestTimeoutMs)

    pendingMainRequests.set(id, {
      resolve: (value) => resolve(value as RuntimeHostMainResponseMap[TName]),
      reject,
      timeout,
    })
  })

  process.send({ type: 'main-request', id, name, payload })
  return await result
}
