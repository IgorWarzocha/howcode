import { connectUiBinding } from '@howaboua/pi-durable-ui'
import * as Schema from 'effect/Schema'
import type {
  PackageUiBindingEvent,
  PackageUiReference,
} from '../../../shared/package-ui-contracts'
import { PackageUiBindingEventSchema } from '../../../shared/package-ui-schema'

/** Authenticated framing only. The SDK owns validated state, hydration and subscribers. */
export async function connectPackageUiBinding(reference: PackageUiReference, signal: AbortSignal) {
  const bridge = window.piDesktop
  if (
    !(
      bridge?.openPackageUiBinding &&
      bridge.operatePackageUiBinding &&
      bridge.closePackageUiBinding
    )
  )
    throw new Error('Package UI binding bridge is unavailable.')
  const sessionId = crypto.randomUUID()
  const operate = bridge.operatePackageUiBinding
  const close = bridge.closePackageUiBinding
  const open = bridge.openPackageUiBinding
  const listeners = new Set<(event: PackageUiBindingEvent) => void>()
  let source: EventSource | undefined
  let failure: unknown
  let retired = false
  const dispatch = (event: PackageUiBindingEvent) => {
    if (event.type === 'error') failure = new Error(event.error)
    for (const listener of listeners) listener(event)
  }
  const cancel = (operationId: string) =>
    retired
      ? Promise.resolve(null)
      : operate({ sessionId, operationId, kind: 'cancel', name: '', input: null })
  const events = async function* (
    predicate: (event: PackageUiBindingEvent) => boolean,
    lifetime: AbortSignal,
  ): AsyncGenerator<PackageUiBindingEvent, void> {
    const queue: PackageUiBindingEvent[] = []
    let wake: (() => void) | undefined
    const receive = (event: PackageUiBindingEvent) => {
      if (event.type === 'error' || predicate(event)) {
        if (queue.length >= 256 && event.type !== 'error') {
          dispatch({ type: 'error', error: 'Package UI event consumer fell behind.' })
          return
        }
        queue.push(event)
        wake?.()
      }
    }
    const abort = () => wake?.()
    listeners.add(receive)
    lifetime.addEventListener('abort', abort, { once: true })
    try {
      while (true) {
        lifetime.throwIfAborted()
        if (failure) throw failure
        if (queue.length === 0)
          await new Promise<void>((resolve) => {
            wake = resolve
          })
        lifetime.throwIfAborted()
        yield* queue.splice(0)
      }
    } finally {
      listeners.delete(receive)
      lifetime.removeEventListener('abort', abort)
    }
  }
  return connectUiBinding(
    {
      async *snapshots({ signal: lifetime }) {
        const reader = new AbortController()
        const iterator = events(
          (event) => event.type === 'snapshot',
          AbortSignal.any([lifetime, reader.signal]),
        )
        const first = iterator.next()
        void first.catch(() => undefined)
        let closing: Promise<void> | undefined
        const retire = () => {
          retired = true
          closing ??= close({ sessionId })
          void closing.catch((error) => console.error('Package UI session cleanup failed.', error))
        }
        lifetime.addEventListener('abort', retire, { once: true })
        try {
          lifetime.throwIfAborted()
          await open({ ...reference, sessionId })
          lifetime.throwIfAborted()
          source = new EventSource(
            `/__howcode/events/package-ui?sessionId=${encodeURIComponent(sessionId)}`,
          )
          source.onmessage = (message) => {
            try {
              dispatch(
                Schema.decodeUnknownSync(PackageUiBindingEventSchema)(JSON.parse(message.data)),
              )
            } catch (error) {
              dispatch({
                type: 'error',
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
          source.onerror = () => {
            source?.close()
            dispatch({
              type: 'error',
              error: 'Package UI channel disconnected. Remount to reconnect.',
            })
          }
          const initial = await first
          if (!initial.done && initial.value.type === 'snapshot') yield initial.value.snapshot
          for await (const event of iterator) if (event.type === 'snapshot') yield event.snapshot
        } finally {
          reader.abort()
          lifetime.removeEventListener('abort', retire)
          source?.close()
          retire()
          await closing
          // The SDK lifetime abort wakes the outstanding event read before return.
          await iterator.return(undefined)
        }
      },
      async call(name, input, { signal: lifetime }) {
        lifetime.throwIfAborted()
        const operationId = crypto.randomUUID()
        const abort = () => {
          void cancel(operationId).catch((error) =>
            console.error('Package UI action cancellation failed.', error),
          )
        }
        lifetime.addEventListener('abort', abort, { once: true })
        try {
          const value = await operate({ sessionId, operationId, kind: 'call', name, input })
          lifetime.throwIfAborted()
          return value
        } finally {
          lifetime.removeEventListener('abort', abort)
        }
      },
      async *stream(name, input, { signal: lifetime }) {
        lifetime.throwIfAborted()
        const operationId = crypto.randomUUID()
        const reader = new AbortController()
        const iterator = events(
          (event) => 'operationId' in event && event.operationId === operationId,
          AbortSignal.any([lifetime, reader.signal]),
        )
        const first = iterator.next()
        void first.catch(() => undefined)
        const abort = () => {
          void cancel(operationId).catch((error) =>
            console.error('Package UI stream cancellation failed.', error),
          )
        }
        lifetime.addEventListener('abort', abort, { once: true })
        try {
          await operate({ sessionId, operationId, kind: 'stream', name, input })
          let item = await first
          while (!item.done) {
            const event = item.value
            if (event.type === 'end') return
            if (event.type === 'operation-error') throw new Error(event.error)
            if (event.type === 'value') yield event.value
            item = await iterator.next()
          }
        } finally {
          reader.abort()
          lifetime.removeEventListener('abort', abort)
          await cancel(operationId)
          await iterator.return(undefined)
        }
      },
    },
    { signal },
  )
}
