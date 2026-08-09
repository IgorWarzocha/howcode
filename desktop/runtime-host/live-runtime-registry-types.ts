import type * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'

export class RuntimeRegistryError extends Schema.TaggedError<RuntimeRegistryError>()(
  'RuntimeRegistryError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type ExistingRuntimeInput = {
  runtimeKey: string
  settingsCwd: string | null
  chatGroupId: string | null
}

export type NewRuntimeInput = {
  cwd: string
  sessionDir: string | null
  branchName: string | null
  chatGroupId: string | null
}

export type RuntimeRegistryAdapters<Runtime> = {
  createExisting: (
    input: ExistingRuntimeInput,
  ) => Effect.Effect<Runtime, RuntimeRegistryError, Scope.Scope>
  createNew: (input: NewRuntimeInput) => Effect.Effect<Runtime, RuntimeRegistryError, Scope.Scope>
  runtimeKey: (runtime: Runtime) => string | null
  runtimeCwd: (runtime: Runtime) => string
  setBranchName: (runtime: Runtime, branchName: string | null) => void
  isWorking: (runtime: Runtime) => boolean
  hasPendingDialog: (runtime: Runtime) => boolean
  reload: (runtime: Runtime) => Effect.Effect<void, RuntimeRegistryError>
  abort: (runtime: Runtime) => Effect.Effect<void>
  release: (runtime: Runtime) => Effect.Effect<void>
}

export interface RuntimeRegistry<Runtime> {
  readonly getCached: (runtimeKey: string) => Effect.Effect<Runtime | null, RuntimeRegistryError>
  readonly getOrCreate: (
    input: ExistingRuntimeInput & { readonly suspendDisposal: boolean },
  ) => Effect.Effect<Runtime, RuntimeRegistryError>
  readonly createNew: (input: NewRuntimeInput) => Effect.Effect<Runtime, RuntimeRegistryError>
  readonly withMutationLock: <A, E, R>(
    runtimeKey: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>
  readonly reloadIfSafe: (
    runtimeKey: string,
    useMutationLock: boolean,
  ) => Effect.Effect<boolean, RuntimeRegistryError>
  readonly invalidate: (input: {
    readonly runtimeKey: string | null
    readonly projectPath: string | null
  }) => Effect.Effect<void, RuntimeRegistryError>
  readonly scheduleDisposal: (runtimeKey: string) => Effect.Effect<void>
  readonly suspendDisposal: (runtimeKey: string) => Effect.Effect<void>
  readonly dispose: (input: {
    readonly projectPath: string | null
    readonly runtimeKeys: ReadonlySet<string>
  }) => Effect.Effect<void>
  readonly disposeAll: Effect.Effect<void>
}
