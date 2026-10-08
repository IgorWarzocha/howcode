import type { UiBinding, UiCleanup } from '@howaboua/pi-durable-ui'
import * as Schema from 'effect/Schema'
import type {
  PackageUiBindingEvent,
  PackageUiBindingFactory,
  PackageUiOpen,
  PackageUiOperation,
  PackageUiSessionReference,
} from '../../../shared/package-ui-contracts.ts'
import {
  PackageUiBindingEventSchema,
  PackageUiOpenSchema,
  PackageUiOperationSchema,
  PackageUiSessionSchema,
} from '../../../shared/package-ui-schema.ts'

type Session = {
  id: string
  controller: AbortController
  binding?: UiBinding
  cleanup?: UiCleanup
  events: PackageUiBindingEvent[]
  wake?: () => void
  reading: boolean
  operations: Map<string, { controller: AbortController; done: Promise<unknown> }>
  cancelled: Set<string>
  completed: Set<string>
  admission?: ReturnType<typeof setTimeout>
  initializing?: Promise<void>
}

/** Installed generations own sessions. Each session owns subscriptions and native work. */
export function createPackageUiBindings(
  resolveGeneration: (
    request: PackageUiOpen,
  ) => Promise<{ factory: PackageUiBindingFactory; signal: AbortSignal }>,
) {
  const sessions = new Map<string, Session>()
  const closing = new Map<string, Promise<void>>()
  const retired = new Set<string>()
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
  const current = (id: string) => {
    const session = sessions.get(id)
    if (!session) throw new Error('Package UI binding is closed.')
    session.controller.signal.throwIfAborted()
    return session
  }
  const publish = (session: Session, event: PackageUiBindingEvent) => {
    if (session.controller.signal.aborted) return
    const validated = Schema.decodeUnknownSync(PackageUiBindingEventSchema)(event)
    if (session.events.length >= 256) {
      session.events = [{ type: 'error', error: 'Package UI event consumer fell behind.' }]
      void close(session.id).catch((error) =>
        console.error('Package UI overflow cleanup failed.', error),
      )
    } else session.events.push(validated)
    session.wake?.()
  }
  const close = (id: string): Promise<void> => {
    const pending = closing.get(id)
    if (pending) return pending
    retired.add(id)
    if (retired.size > 256) {
      const oldest = retired.values().next().value
      if (oldest) retired.delete(oldest)
    }
    const session = sessions.get(id)
    if (!session) return Promise.resolve()
    sessions.delete(id)
    clearTimeout(session.admission)
    session.controller.abort()
    session.wake?.()
    const done = (async () => {
      // Startup owns its error. Retirement must still join an async factory.
      await session.initializing?.catch(() => undefined)
      try {
        await session.cleanup?.()
      } finally {
        await Promise.allSettled(
          [...session.operations.values()].map((operation) => operation.done),
        )
      }
    })().finally(() => closing.delete(id))
    closing.set(id, done)
    return done
  }
  const cancelOperation = async (session: Session, operationId: string) => {
    if (session.completed.has(operationId)) return null
    const operation = session.operations.get(operationId)
    if (!operation) {
      if (session.cancelled.size >= 256)
        throw new Error('Package UI cancellation queue exceeded its limit.')
      session.cancelled.add(operationId)
    }
    operation?.controller.abort()
    await operation?.done.catch(() => undefined)
    return null
  }
  return {
    async openPackageUiBinding(input: PackageUiOpen) {
      const request = Schema.decodeUnknownSync(PackageUiOpenSchema)(input)
      if (!request.sessionId || sessions.has(request.sessionId) || retired.has(request.sessionId))
        throw new Error('Package UI session identity is already in use or empty.')
      const session: Session = {
        id: request.sessionId,
        controller: new AbortController(),
        events: [],
        reading: false,
        operations: new Map(),
        cancelled: new Set(),
        completed: new Set(),
      }
      sessions.set(request.sessionId, session)
      session.admission = setTimeout(() => {
        void close(request.sessionId).catch((error) =>
          console.error('Package UI unclaimed session cleanup failed.', error),
        )
      }, 30_000)
      session.initializing = (async () => {
        const generation = await resolveGeneration(request)
        session.controller.signal.throwIfAborted()
        const retire = () => {
          void close(request.sessionId).catch((error) =>
            console.error('Package UI retirement failed.', error),
          )
        }
        generation.signal.addEventListener('abort', retire, { once: true })
        session.controller.signal.addEventListener(
          'abort',
          () => generation.signal.removeEventListener('abort', retire),
          { once: true },
        )
        generation.signal.throwIfAborted()
        const binding = await generation.factory({
          id: request.id,
          revision: request.revision,
          signal: session.controller.signal,
        })
        session.controller.signal.throwIfAborted()
        session.binding = binding
        session.cleanup = binding.subscribe(
          (snapshot) => publish(session, { type: 'snapshot', snapshot }),
          (error) => publish(session, { type: 'error', error: message(error) }),
        )
        publish(session, { type: 'snapshot', snapshot: binding.getSnapshot() })
      })()
      try {
        await session.initializing
        return undefined
      } catch (error) {
        await close(request.sessionId)
        throw error
      }
    },
    async readPackageUiBindingEvents(input: PackageUiSessionReference) {
      const { sessionId } = Schema.decodeUnknownSync(PackageUiSessionSchema)(input)
      const session = current(sessionId)
      clearTimeout(session.admission)
      if (session.reading) throw new Error('Package UI binding already has an event reader.')
      session.reading = true
      try {
        if (session.events.length === 0)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 15_000)
            session.wake = () => {
              clearTimeout(timer)
              resolve()
            }
          })
        session.controller.signal.throwIfAborted()
        return session.events.splice(0)
      } finally {
        session.reading = false
        delete session.wake
      }
    },
    async operatePackageUiBinding(input: PackageUiOperation) {
      const request = Schema.decodeUnknownSync(PackageUiOperationSchema)(input)
      const session = current(request.sessionId)
      if (request.kind === 'cancel') return cancelOperation(session, request.operationId)
      const binding = session.binding
      if (!binding) throw new Error('Package UI binding is not ready.')
      if (session.operations.has(request.operationId))
        throw new Error('Package UI operation identity already in use.')
      const controller = new AbortController()
      if (session.cancelled.delete(request.operationId)) controller.abort()
      const abort = () => controller.abort()
      session.controller.signal.addEventListener('abort', abort, { once: true })
      const run = async () => {
        controller.signal.throwIfAborted()
        if (request.kind === 'call') {
          const result = await binding.call(request.name, request.input, {
            signal: controller.signal,
          })
          controller.signal.throwIfAborted()
          return Schema.decodeUnknownSync(Schema.Json)(result)
        }
        if (!binding.stream) throw new Error('Package UI binding has no streams.')
        const iterator = binding
          .stream(request.name, request.input, { signal: controller.signal })
          [Symbol.asyncIterator]()
        let returning: Promise<IteratorResult<unknown>> | undefined
        const release = () =>
          (returning ??= Promise.resolve(iterator.return?.() ?? { done: true, value: undefined }))
        const stop = () => {
          void release().catch((error) =>
            console.error('Package UI native stream cleanup failed.', error),
          )
        }
        controller.signal.addEventListener('abort', stop, { once: true })
        try {
          while (true) {
            const item = await iterator.next()
            controller.signal.throwIfAborted()
            if (item.done) break
            publish(session, { type: 'value', operationId: request.operationId, value: item.value })
          }
        } finally {
          controller.signal.removeEventListener('abort', stop)
          await release()
        }
        return null
      }
      const done = Promise.resolve()
        .then(run)
        .finally(() => {
          session.operations.delete(request.operationId)
          session.completed.add(request.operationId)
          if (session.completed.size > 256) {
            const oldest = session.completed.values().next().value
            if (oldest) session.completed.delete(oldest)
          }
          session.controller.signal.removeEventListener('abort', abort)
        })
      session.operations.set(request.operationId, { controller, done })
      if (request.kind === 'call') return done
      void done.then(
        () => publish(session, { type: 'end', operationId: request.operationId }),
        (error) =>
          publish(session, {
            type: 'operation-error',
            operationId: request.operationId,
            error: message(error),
          }),
      )
      return null
    },
    async closePackageUiBinding(input: PackageUiSessionReference) {
      const { sessionId } = Schema.decodeUnknownSync(PackageUiSessionSchema)(input)
      await close(sessionId)
      return undefined
    },
    async dispose() {
      await Promise.all([...sessions.keys()].map(close).concat([...closing.values()]))
    },
  }
}
