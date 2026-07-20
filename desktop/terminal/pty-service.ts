import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import { nodePtyAdapter } from './node-pty.ts'
import type { PtyAdapter } from './types.ts'

export class Service extends Context.Service<Service, PtyAdapter>()('@howcode/Terminal/Pty') {}

export const layer = Layer.succeed(Service, nodePtyAdapter)
