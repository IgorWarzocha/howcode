import type { JsonValue, UiBinding, UiComponent } from '@howaboua/pi-durable-ui'
import type {
  InstalledComponentAdmission,
  InstalledComponentDescriptor,
  InstalledComponentSource,
} from './installed-component-contracts'
import type {
  PackageUiBindingEventSchema,
  PackageUiDescriptorSchema,
  PackageUiOpenSchema,
  PackageUiOperationSchema,
  PackageUiReferenceSchema,
  PackageUiSessionSchema,
} from './package-ui-schema'

export type PackageUiReference = typeof PackageUiReferenceSchema.Type
export type PackageUiDescriptor = typeof PackageUiDescriptorSchema.Type
export type PackageUiJson = JsonValue
export type PackageUiOpen = typeof PackageUiOpenSchema.Type
export type PackageUiSessionReference = typeof PackageUiSessionSchema.Type
export type PackageUiOperation = typeof PackageUiOperationSchema.Type
export type PackageUiBindingEvent = typeof PackageUiBindingEventSchema.Type
export type PackageUiBindingFactory = (
  context: PackageUiReference & { signal: AbortSignal },
) => UiBinding | Promise<UiBinding>

export type PackageUiService = {
  listInstalledComponents(): Promise<InstalledComponentDescriptor[]>
  admitInstalledComponent(request: InstalledComponentAdmission): Promise<undefined>
  loadInstalledComponent(reference: PackageUiReference): Promise<InstalledComponentSource>
  listPackageUis(): Promise<PackageUiDescriptor[]>
  loadPackageUi(reference: PackageUiReference): Promise<{ js: string }>
  openPackageUiBinding(request: PackageUiOpen): Promise<undefined>
  readPackageUiBindingEvents(request: PackageUiSessionReference): Promise<PackageUiBindingEvent[]>
  operatePackageUiBinding(request: PackageUiOperation): Promise<PackageUiJson>
  closePackageUiBinding(request: PackageUiSessionReference): Promise<undefined>
}

/** Trusted package code owns its DOM subtree and any independent framework root. */
export type PackageUiModule = {
  component: UiComponent<unknown>
}
