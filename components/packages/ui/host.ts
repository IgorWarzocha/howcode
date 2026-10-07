import type { PackageUiDescriptor, PackageUiModule } from '../../../shared/package-ui-contracts'
import { watchPackageUiCatalog } from './catalog'
import { invokePackageUiRpcQuery, loadPackageUiQuery } from './query'

export type PackageUiMountState =
  | { status: 'loading' | 'mounted' | 'removed' }
  | { status: 'error'; error: string }

async function loadUiModule(
  descriptor: PackageUiDescriptor,
  signal: AbortSignal,
): Promise<PackageUiModule> {
  if (descriptor.status === 'error') throw new Error(descriptor.error)
  const { js } = await loadPackageUiQuery(descriptor)
  signal.throwIfAborted()
  const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }))
  const revoke = () => URL.revokeObjectURL(url)
  signal.addEventListener('abort', revoke, { once: true })
  try {
    const module: Partial<PackageUiModule> = await import(/* @vite-ignore */ url)
    signal.throwIfAborted()
    if (typeof module.mount !== 'function')
      throw new Error('Package ui.tsx must export mount(container, context).')
    return { mount: module.mount }
  } finally {
    signal.removeEventListener('abort', revoke)
    revoke()
  }
}

/** A package never receives a host React root, only its owned DOM subtree. */
export function mountPackageUi(
  container: HTMLElement,
  descriptor: PackageUiDescriptor,
  receive: (state: PackageUiMountState) => void,
) {
  const lifetime = new AbortController()
  const element = document.createElement('div')
  container.replaceChildren(element)
  let cleanup: (() => void) | undefined
  const reportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    element.textContent = message
    receive({ status: 'error', error: message })
  }
  const ready = (async () => {
    receive({ status: 'loading' })
    try {
      const module = await loadUiModule(descriptor, lifetime.signal)
      const dispose = await module.mount(element, {
        id: descriptor.id,
        revision: descriptor.revision,
        signal: lifetime.signal,
        async call(method, input) {
          lifetime.signal.throwIfAborted()
          const result = await invokePackageUiRpcQuery({
            id: descriptor.id,
            revision: descriptor.revision,
            method,
            input,
          })
          lifetime.signal.throwIfAborted()
          return result
        },
      })
      if (typeof dispose !== 'function')
        throw new Error('Package mount must return a cleanup function.')
      if (lifetime.signal.aborted) dispose()
      else {
        cleanup = dispose
        receive({ status: 'mounted' })
      }
    } catch (error) {
      if (!lifetime.signal.aborted) {
        lifetime.abort()
        reportError(error)
      }
    }
  })()
  return {
    ready,
    dispose() {
      lifetime.abort()
      const dispose = cleanup
      cleanup = undefined
      try {
        dispose?.()
      } catch (error) {
        reportError(error)
      } finally {
        element.remove()
      }
    },
  }
}

/** Mount one installed ID wherever the caller owns a container. No layout policy. */
export function mountPackageUiHost(
  container: HTMLElement,
  id: string,
  receive: (state: PackageUiMountState) => void = () => undefined,
) {
  let mounted: ReturnType<typeof mountPackageUi> | undefined
  let revision: string | undefined
  const unsubscribe = watchPackageUiCatalog((catalog) => {
    const descriptor =
      catalog.status === 'ready' ? catalog.items.find((item) => item.id === id) : undefined
    if (descriptor && descriptor.revision === revision) return
    mounted?.dispose()
    mounted = undefined
    revision = descriptor?.revision
    if (catalog.status === 'error') {
      container.textContent = catalog.error
      receive({ status: 'error', error: catalog.error })
    } else if (descriptor) {
      mounted = mountPackageUi(container, descriptor, (state) => {
        // A failed transport load can recover on the next catalog invalidation.
        if (state.status === 'error' && descriptor.status === 'ready') revision = undefined
        receive(state)
      })
    } else {
      container.replaceChildren()
      receive({ status: 'removed' })
    }
  })
  return () => {
    unsubscribe()
    mounted?.dispose()
    container.replaceChildren()
  }
}
