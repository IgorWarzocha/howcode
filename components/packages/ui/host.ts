import { mountComponent, themeCss, type UiSession } from '@howaboua/pi-durable-ui'
import type { PackageUiDescriptor, PackageUiModule } from '../../../shared/package-ui-contracts'
import { connectPackageUiBinding } from './binding'
import { watchPackageUiCatalog } from './catalog'
import { loadPackageUiQuery } from './query'

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
    if (!module.component) throw new Error('Package ui.tsx must export component.')
    return { component: module.component }
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
  element.setAttribute('data-durable-ui', '')
  element.setAttribute('data-howcode-package-ui', '')
  const theme = document.createElement('style')
  theme.textContent = `${themeCss}
    [data-howcode-package-ui][data-howcode-package-ui][data-durable-ui],
    [data-howcode-package-ui][data-howcode-package-ui] [data-durable-ui] {
      --durable-ui-background: var(--panel);
      --durable-ui-foreground: var(--text);
      --durable-ui-muted: var(--muted);
      --durable-ui-border: var(--border);
      --durable-ui-accent: var(--accent);
    }
  `
  container.replaceChildren(theme, element)
  let session: UiSession | undefined
  const reportError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    element.textContent = message
    receive({ status: 'error', error: message })
  }
  const ready = (async () => {
    receive({ status: 'loading' })
    try {
      const module = await loadUiModule(descriptor, lifetime.signal)
      const binding = await connectPackageUiBinding(descriptor, lifetime.signal)
      void binding.closed.catch((error) => {
        if (lifetime.signal.aborted) console.error('Package UI binding cleanup failed.', error)
        else reportError(error)
      })
      session = mountComponent(module.component, element, {
        id: descriptor.id,
        signal: lifetime.signal,
        binding,
      })
      // Cleanup can finish after replacement. Diagnose it without changing host state.
      void session.closed.catch((error: unknown) => {
        if (lifetime.signal.aborted)
          console.error(
            `Package UI cleanup failed (${descriptor.id}@${descriptor.revision}).`,
            error,
          )
      })
      await session.ready
      if (!lifetime.signal.aborted) receive({ status: 'mounted' })
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
      // closed above is the single cleanup-error observer.
      if (session) void session.dispose().catch(() => undefined)
      element.remove()
      theme.remove()
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
