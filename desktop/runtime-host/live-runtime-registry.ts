import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import { getPersistedSessionPath } from '../../shared/session-paths.ts'
import { getPiModule } from '../pi-module.ts'
import { buildComposerState } from '../runtime/composer-state.ts'
import {
  clearPiExtensionUi,
  hasPendingPiExtensionDialog,
} from '../runtime/pi-extension-ui-state.ts'
import {
  abortRuntimeExtensionCommand,
  createLiveRuntime,
  isRuntimeExtensionCommandRunning,
  refreshRuntimeExtensionBindings as refreshRuntimeExtensionBindingsWithReload,
} from './live-runtime-factory.ts'
import type { ExistingRuntimeInput, NewRuntimeInput } from './live-runtime-registry-core.ts'
import { Factory, layer, registryError, Service } from './live-runtime-registry-service.ts'
import { type LivePiRuntime, makeRuntimeUpdateScheduler } from './live-runtime-updates.ts'
import { publishComposerUpdate, publishPiExtensionUiUpdate } from './live-thread-publisher.ts'

export { abortRuntimeExtensionCommand, isRuntimeExtensionCommandRunning }

const liveRuntimeFactoryHandlers = {
  reloadRuntimeSettingsIfSafe: (runtimeKey: string) => reloadRuntimeSettingsIfSafe(runtimeKey),
  scheduleRuntimeDisposal: (runtimeKey: string) => scheduleRuntimeDisposal(runtimeKey),
  suspendRuntimeDisposal: (runtimeKey: string) => suspendRuntimeDisposal(runtimeKey),
}

function fromPromise<A>(operation: string, evaluate: () => PromiseLike<A>) {
  return Effect.tryPromise({
    try: evaluate,
    catch: (error) => registryError(operation, error),
  })
}

function bestEffort(evaluate: () => void | PromiseLike<void>) {
  return Effect.tryPromise({
    try: async () => await evaluate(),
    catch: () => undefined,
  }).pipe(Effect.ignore)
}

const factoryLayer = Layer.succeed(
  Factory,
  Factory.of({
    createExisting: (input: ExistingRuntimeInput) =>
      Effect.gen(function* () {
        const updates = yield* makeRuntimeUpdateScheduler
        return yield* fromPromise('createExisting', async () => {
          const { SessionManager } = await getPiModule()
          const sessionManager = SessionManager.open(input.runtimeKey)
          return await createLiveRuntime(
            {
              cwd: sessionManager.getCwd(),
              settingsCwd: input.settingsCwd,
              chatGroupId: input.chatGroupId,
              sessionManager,
            },
            liveRuntimeFactoryHandlers,
            updates,
          )
        })
      }),
    createNew: (input: NewRuntimeInput) =>
      Effect.gen(function* () {
        const updates = yield* makeRuntimeUpdateScheduler
        return yield* fromPromise('createNew', () =>
          createLiveRuntime(
            {
              cwd: input.cwd,
              sessionDir: input.sessionDir,
              settingsCwd: input.sessionDir,
              chatGroupId: input.chatGroupId,
            },
            liveRuntimeFactoryHandlers,
            updates,
          ),
        )
      }),
    runtimeKey: (runtime) => getPersistedSessionPath(runtime.session.sessionFile),
    runtimeCwd: (runtime) => path.resolve(runtime.cwd),
    setBranchName: (runtime, branchName) => {
      runtime.branchName = branchName
    },
    isWorking: (runtime) =>
      runtime.session.isStreaming ||
      runtime.session.isCompacting ||
      isRuntimeExtensionCommandRunning(runtime),
    hasPendingDialog: hasPendingPiExtensionDialog,
    reload: (runtime) =>
      fromPromise('reload', async () => {
        await runtime.session.reload()
        await refreshRuntimeExtensionBindings(runtime)
        const composer = await buildComposerState(runtime)
        if (!runtime.updates.isActive()) return
        publishComposerUpdate(composer, {
          projectId: runtime.cwd,
          sessionPath: runtime.session.sessionFile ?? null,
        })
      }),
    abort: (runtime) =>
      bestEffort(async () => {
        abortRuntimeExtensionCommand(runtime)
        if (runtime.session.isStreaming || runtime.session.isCompacting) {
          await runtime.session.abort()
        }
      }),
    release: (runtime) =>
      Effect.gen(function* () {
        yield* bestEffort(() => {
          clearPiExtensionUi(runtime)
          publishPiExtensionUiUpdate(runtime)
        })
        runtime.updates.close()
        yield* bestEffort(() => runtime.session.dispose())
      }),
  }),
)

const registryRuntime = ManagedRuntime.make(layer.pipe(Layer.provide(factoryLayer)))

function run<A, E>(evaluate: (service: Service['Service']) => Effect.Effect<A, E>) {
  return registryRuntime.runPromise(Effect.flatMap(Service, evaluate))
}

function fork(evaluate: (service: Service['Service']) => Effect.Effect<unknown>) {
  registryRuntime.runFork(Effect.flatMap(Service, evaluate))
}

export function refreshRuntimeExtensionBindings(runtime: LivePiRuntime) {
  return refreshRuntimeExtensionBindingsWithReload(runtime, reloadRuntimeSettingsIfSafe)
}

export function getCachedRuntimeForSessionPath(sessionPath: string) {
  return run((service) => service.getCached(sessionPath))
}

export function getOrCreateRuntimeForSessionPath(
  sessionPath: string,
  options: {
    suspendDisposal?: boolean | undefined
    settingsCwd?: string | null | undefined
    chatGroupId?: string | null | undefined
  } = {},
) {
  return run((service) => service.getOrCreate(sessionPath, options))
}

export function createRuntimeForNewSession(
  cwd: string,
  sessionDir?: string | null | undefined,
  options: {
    branchName?: string | null | undefined
    chatGroupId?: string | null | undefined
  } = {},
) {
  return run((service) => service.createNew(cwd, sessionDir ?? null, options))
}

export function withRuntimeMutationLock<T>(runtimeKey: string, task: () => Promise<T>) {
  return run((service) =>
    service.withMutationLock(
      runtimeKey,
      Effect.tryPromise({
        try: task,
        catch: (error) => error,
      }),
    ),
  )
}

export function reloadRuntimeSettingsIfSafe(
  sessionPath: string,
  options: { useMutationLock?: boolean | undefined } = {},
) {
  return run((service) => service.reloadIfSafe(sessionPath, options.useMutationLock ?? true))
}

export function scheduleRuntimeDisposal(runtimeKey: string) {
  fork((service) => service.scheduleDisposal(runtimeKey))
}

export function suspendRuntimeDisposal(runtimeKey: string) {
  fork((service) => service.suspendDisposal(runtimeKey))
}

export async function invalidateRuntimeSettings(
  request: {
    sessionPath?: string | null | undefined
    projectPath?: string | null | undefined
  } = {},
) {
  await run((service) => service.invalidate(request))
  return { ok: true as const }
}

export async function disposeRuntimeHosts(
  request: { sessionPaths?: string[] | undefined; projectPath?: string | null | undefined } = {},
) {
  await run((service) => service.dispose(request))
  return { ok: true as const }
}

export function disposeAllRuntimeHosts() {
  return run((service) => service.disposeAll)
}
