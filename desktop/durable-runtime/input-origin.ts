import { copyJson } from '@earendil-works/chord'
import type { InputEntry } from '@earendil-works/pi-durable'
import * as Schema from 'effect/Schema'
import {
  type InputOrigin,
  InputOriginSchema,
  TrustedInputDataSchema,
  trustedInputKind,
} from '../../shared/input-origin.ts'

const hostOrigin = Symbol('host-input-origin')
export type TrustedInputOrigin = InputOrigin & { readonly [hostOrigin]: true }

function trusted(origin: InputOrigin): TrustedInputOrigin {
  return Object.freeze({
    ...Schema.decodeUnknownSync(InputOriginSchema)(origin),
    [hostOrigin]: true as const,
  })
}

// Only ingress adapters create these values; never decode an origin from a caller payload.
export function humanComposerOrigin(): TrustedInputOrigin {
  return trusted({ kind: 'human-composer' })
}

/** A dedicated setup action grants its kickoff, not prompt-activity attribution. */
export function setupActionOrigin(): TrustedInputOrigin {
  return trusted({ kind: 'human-action', action: 'assistant-setup' })
}

export function componentActionOrigin(): TrustedInputOrigin {
  return trusted({ kind: 'human-action', action: 'component-request' })
}

export function agentInputOrigin(conversationId: string, taskId?: string): TrustedInputOrigin {
  return trusted({
    kind: 'agent',
    conversationId,
    ...(taskId === undefined ? {} : { taskId }),
  })
}

export function mcpInputOrigin(): TrustedInputOrigin {
  return trusted({ kind: 'mcp' })
}

export function scheduledInputOrigin(source: string): TrustedInputOrigin {
  return trusted({ kind: 'scheduled', source })
}

export function stampInputOrigin(
  origin: TrustedInputOrigin,
  at: number,
  inputEntry?: InputEntry,
): InputEntry {
  if (origin[hostOrigin] !== true) throw new Error('Input origin must be host-derived.')
  if (inputEntry?.kind === trustedInputKind || inputEntry?.kind.startsWith('pi.'))
    throw new Error('Input entry kind is reserved for the host.')
  return {
    kind: trustedInputKind,
    data: copyJson(
      Schema.decodeUnknownSync(TrustedInputDataSchema)({
        origin,
        at,
        ...(inputEntry ? { inputEntry } : {}),
      }),
    ),
  }
}
