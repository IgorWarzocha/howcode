import * as Schema from 'effect/Schema'
import type { PackageUiReference } from '../../../shared/package-ui-contracts'
import {
  PackageUiCatalogSchema,
  PackageUiModuleSourceSchema,
} from '../../../shared/package-ui-schema'

export async function listPackageUisQuery() {
  if (!window.piDesktop?.listPackageUis) throw new Error('Package UI bridge is unavailable.')
  return Schema.decodeUnknownSync(PackageUiCatalogSchema)(await window.piDesktop.listPackageUis())
}

export async function loadPackageUiQuery(reference: PackageUiReference) {
  if (!window.piDesktop?.loadPackageUi) throw new Error('Package UI bridge is unavailable.')
  return Schema.decodeUnknownSync(PackageUiModuleSourceSchema)(
    await window.piDesktop.loadPackageUi(reference),
  )
}
