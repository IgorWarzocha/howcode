import type { JsonValue, UiContext, UiMount } from '@howaboua/pi-durable-ui'
import type {
  PackageUiDescriptorSchema,
  PackageUiReferenceSchema,
  PackageUiRpcRequestSchema,
} from './package-ui-schema'

export type PackageUiReference = typeof PackageUiReferenceSchema.Type
export type PackageUiDescriptor = typeof PackageUiDescriptorSchema.Type
export type PackageUiRpcRequest = typeof PackageUiRpcRequestSchema.Type
export type PackageUiJson = JsonValue

export type PackageUiService = {
  listPackageUis(): Promise<PackageUiDescriptor[]>
  loadPackageUi(reference: PackageUiReference): Promise<{ js: string }>
  invokePackageUiRpc(request: PackageUiRpcRequest): Promise<PackageUiJson>
}

/** Trusted package code owns its DOM subtree and any independent framework root. */
export type PackageUiContext = UiContext

export type PackageUiModule = {
  mount: UiMount
}

export type PackageUiRpcHandler = (
  method: string,
  input: PackageUiJson,
  context: PackageUiReference & { signal: AbortSignal },
) => unknown | Promise<unknown>
