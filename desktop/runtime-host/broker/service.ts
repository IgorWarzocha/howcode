import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import { makeRuntimeHostBroker } from './core.ts'
import { liveProcessAdapter } from './live-process.ts'
import type { RuntimeHostBroker } from './types.ts'

export class Service extends Context.Service<Service, RuntimeHostBroker>()(
  '@howcode/RuntimeHostBroker',
) {}

export const layer = Layer.effect(
  Service,
  makeRuntimeHostBroker(liveProcessAdapter, { idleTimeout: '5 minutes' }),
)
