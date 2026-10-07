import { subscribeDesktopEvents } from '@howcode/query/desktop-query'
import type { PackageUiDescriptor } from '../../../shared/package-ui-contracts'
import { listPackageUisQuery } from './query'

export type PackageUiCatalogState =
  | { status: 'ready'; items: PackageUiDescriptor[] }
  | { status: 'error'; error: string }

/** Subscribe before the first read so an install cannot fall between them. */
export function watchPackageUiCatalog(receive: (state: PackageUiCatalogState) => void) {
  const lifetime = new AbortController()
  let revision = 0
  const refresh = async () => {
    const requested = ++revision
    let state: PackageUiCatalogState
    try {
      state = { status: 'ready', items: await listPackageUisQuery() }
    } catch (error) {
      state = { status: 'error', error: error instanceof Error ? error.message : String(error) }
    }
    if (!lifetime.signal.aborted && requested === revision) receive(state)
  }
  const unsubscribe = subscribeDesktopEvents((event) => {
    if (event.type === 'package-ui-invalidation') void refresh()
  })
  void refresh()
  return () => {
    lifetime.abort()
    unsubscribe()
  }
}
