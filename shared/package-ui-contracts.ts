import type * as Schema from 'effect/Schema'
import type {
  PackageUiDescriptorSchema,
  PackageUiReferenceSchema,
  PackageUiRpcRequestSchema,
} from './package-ui-schema'

export type PackageUiReference = typeof PackageUiReferenceSchema.Type
export type PackageUiDescriptor = typeof PackageUiDescriptorSchema.Type
export type PackageUiRpcRequest = typeof PackageUiRpcRequestSchema.Type
export type PackageUiJson = typeof Schema.Json.Type

export type PackageUiService = {
  listPackageUis(): Promise<PackageUiDescriptor[]>
  loadPackageUi(reference: PackageUiReference): Promise<{ js: string }>
  invokePackageUiRpc(request: PackageUiRpcRequest): Promise<PackageUiJson>
}

/** Trusted package code owns its DOM subtree and any independent framework root. */
export type PackageUiContext = PackageUiReference & {
  signal: AbortSignal
  call(method: string, input: PackageUiJson): Promise<PackageUiJson>
}

export type PackageUiModule = {
  mount(container: HTMLElement, context: PackageUiContext): (() => void) | Promise<() => void>
}

export type PackageUiRpcHandler = (
  method: string,
  input: PackageUiJson,
  context: PackageUiReference & { signal: AbortSignal },
) => unknown | Promise<unknown>
