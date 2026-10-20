import type { InputOrigin, InputTaskAuthorization } from '@howaboua/howcode-sdk/input-delivery'

type Authorization = {
  readonly origin: InputOrigin
  readonly nativeRun: number
  readonly signal?: AbortSignal
}
const authorizations = new WeakMap<InputTaskAuthorization, Authorization>()

/** Shared authority identity, independent of native runtime acquisition and plugin dispatch. */
export function retainInputAuthorization(value: Authorization): InputTaskAuthorization {
  const token = Object.freeze({ kind: 'host-input-task-authorization' as const })
  authorizations.set(token, value)
  return token
}

export function releaseInputAuthorization(token: InputTaskAuthorization) {
  authorizations.delete(token)
}

export function resolveInputAuthorization(token: InputTaskAuthorization) {
  const authorization = authorizations.get(token)
  if (!authorization) throw new Error('Input task authorization is unavailable or expired.')
  authorization.signal?.throwIfAborted()
  return authorization
}

/** Only renderer-action ingress calls this; raw plugin RPC and MCP receive no grant. */
export async function withRendererTaskAuthorization<T>(
  operation: (authorization: InputTaskAuthorization) => Promise<T>,
): Promise<T> {
  const token = retainInputAuthorization({
    origin: { kind: 'human-action', action: 'component-request' },
    nativeRun: 0,
  })
  try {
    return await operation(token)
  } finally {
    releaseInputAuthorization(token)
  }
}
