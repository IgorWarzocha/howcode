import path from 'node:path'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { normalizeRuntimeSettingsCwd } from '../runtime/runtime-settings-cwd.ts'
import type { PiRuntime } from '../runtime/types.ts'
import {
  type ExistingRuntimeInput,
  makeRuntimeRegistry,
  type NewRuntimeInput,
  RuntimeRegistryError,
} from './live-runtime-registry-core.ts'

const RUNTIME_IDLE_TIMEOUT = '15 minutes'

export interface FactoryInterface {
  readonly createExisting: (
    input: ExistingRuntimeInput,
  ) => Effect.Effect<PiRuntime, RuntimeRegistryError>
  readonly createNew: (input: NewRuntimeInput) => Effect.Effect<PiRuntime, RuntimeRegistryError>
  readonly runtimeKey: (runtime: PiRuntime) => string | null
  readonly runtimeCwd: (runtime: PiRuntime) => string
  readonly setBranchName: (runtime: PiRuntime, branchName: string | null) => void
  readonly isWorking: (runtime: PiRuntime) => boolean
  readonly hasPendingDialog: (runtime: PiRuntime) => boolean
  readonly reload: (runtime: PiRuntime) => Effect.Effect<void, RuntimeRegistryError>
  readonly abort: (runtime: PiRuntime) => Effect.Effect<void>
  readonly release: (runtime: PiRuntime) => Effect.Effect<void>
}

export class Factory extends Context.Service<Factory, FactoryInterface>()(
  '@howcode/LiveRuntimeRegistry/Factory',
) {}

export interface Interface {
  readonly getCached: (sessionPath: string) => Effect.Effect<PiRuntime | null, RuntimeRegistryError>
  readonly getOrCreate: (
    sessionPath: string,
    options: {
      readonly suspendDisposal?: boolean | undefined
      readonly settingsCwd?: string | null | undefined
      readonly chatGroupId?: string | null | undefined
    },
  ) => Effect.Effect<PiRuntime, RuntimeRegistryError>
  readonly createNew: (
    cwd: string,
    sessionDir: string | null,
    options: {
      readonly branchName?: string | null | undefined
      readonly chatGroupId?: string | null | undefined
    },
  ) => Effect.Effect<PiRuntime, RuntimeRegistryError>
  readonly withMutationLock: <A, E, R>(
    runtimeKey: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>
  readonly reloadIfSafe: (
    sessionPath: string,
    useMutationLock: boolean,
  ) => Effect.Effect<boolean, RuntimeRegistryError>
  readonly invalidate: (request: {
    readonly sessionPath?: string | null | undefined
    readonly projectPath?: string | null | undefined
  }) => Effect.Effect<void, RuntimeRegistryError>
  readonly scheduleDisposal: (runtimeKey: string) => Effect.Effect<void>
  readonly suspendDisposal: (runtimeKey: string) => Effect.Effect<void>
  readonly dispose: (request: {
    readonly sessionPaths?: readonly string[] | undefined
    readonly projectPath?: string | null | undefined
  }) => Effect.Effect<void>
  readonly disposeAll: Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()(
  '@howcode/LiveRuntimeRegistry',
) {}

export function registryError(operation: string, error: unknown) {
  return new RuntimeRegistryError({
    operation,
    message: error instanceof Error ? error.message : String(error),
  })
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const factory = yield* Factory
    const registry = yield* makeRuntimeRegistry<PiRuntime>(
      {
        createExisting: factory.createExisting,
        createNew: factory.createNew,
        runtimeKey: factory.runtimeKey,
        runtimeCwd: factory.runtimeCwd,
        setBranchName: factory.setBranchName,
        isWorking: factory.isWorking,
        hasPendingDialog: factory.hasPendingDialog,
        reload: factory.reload,
        abort: factory.abort,
        release: factory.release,
      },
      { idleTimeout: RUNTIME_IDLE_TIMEOUT },
    )

    const getCached = Effect.fn('LiveRuntimeRegistry.getCached')(function* (sessionPath: string) {
      const runtimeKey = getPersistedSessionPath(sessionPath)
      return runtimeKey ? yield* registry.getCached(runtimeKey) : null
    })

    const getOrCreate = Effect.fn('LiveRuntimeRegistry.getOrCreate')(function* (
      sessionPath: string,
      options: Parameters<Interface['getOrCreate']>[1],
    ) {
      const runtimeKey = getPersistedSessionPath(sessionPath)
      if (!runtimeKey) {
        return yield* Effect.fail(
          registryError(
            'getOrCreate',
            new Error('A persisted session path is required to open a live runtime.'),
          ),
        )
      }
      return yield* registry.getOrCreate({
        runtimeKey,
        settingsCwd: normalizeRuntimeSettingsCwd(options.settingsCwd),
        chatGroupId: options.chatGroupId ?? null,
        suspendDisposal: options.suspendDisposal ?? false,
      })
    })

    const createNew = Effect.fn('LiveRuntimeRegistry.createNew')(function* (
      cwd: string,
      sessionDir: string | null,
      options: Parameters<Interface['createNew']>[2],
    ) {
      return yield* registry.createNew({
        cwd,
        sessionDir,
        branchName: options.branchName ?? null,
        chatGroupId: options.chatGroupId ?? null,
      })
    })

    const reloadIfSafe = Effect.fn('LiveRuntimeRegistry.reloadIfSafe')(function* (
      sessionPath: string,
      useMutationLock: boolean,
    ) {
      const runtimeKey = getPersistedSessionPath(sessionPath)
      return runtimeKey ? yield* registry.reloadIfSafe(runtimeKey, useMutationLock) : false
    })

    const invalidate = Effect.fn('LiveRuntimeRegistry.invalidate')(function* (
      request: Parameters<Interface['invalidate']>[0],
    ) {
      const projectPath = request.projectPath?.trim()
      yield* registry.invalidate({
        runtimeKey: getPersistedSessionPath(request.sessionPath),
        projectPath: projectPath ? path.resolve(projectPath) : null,
      })
    })

    const dispose = Effect.fn('LiveRuntimeRegistry.dispose')(function* (
      request: Parameters<Interface['dispose']>[0],
    ) {
      const runtimeKeys = new Set(
        (request.sessionPaths ?? [])
          .map((sessionPath) => getPersistedSessionPath(sessionPath))
          .filter((sessionPath): sessionPath is string => Boolean(sessionPath)),
      )
      const projectPath = request.projectPath?.trim()
      yield* registry.dispose({
        runtimeKeys,
        projectPath: projectPath ? path.resolve(projectPath) : null,
      })
    })

    return Service.of({
      getCached,
      getOrCreate,
      createNew,
      withMutationLock: registry.withMutationLock,
      reloadIfSafe,
      invalidate,
      scheduleDisposal: registry.scheduleDisposal,
      suspendDisposal: registry.suspendDisposal,
      dispose,
      disposeAll: registry.disposeAll,
    })
  }),
)
