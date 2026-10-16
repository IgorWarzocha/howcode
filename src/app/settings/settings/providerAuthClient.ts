import * as Schema from 'effect/Schema'
import { type ProviderAuthRequest, ProviderAuthResponse } from '../../../../shared/provider-auth'

export async function requestProviderAuth(request: ProviderAuthRequest) {
  if (!window.piDesktop?.providerAuth)
    throw new Error('Provider accounts require an updated shell runtime.')
  return Schema.decodeUnknownSync(ProviderAuthResponse)(
    await window.piDesktop.providerAuth(request),
  )
}

export async function requestProviderLogin(
  request: Exclude<ProviderAuthRequest, { operation: 'list' | 'logout' }>,
) {
  const result = await requestProviderAuth(request)
  if (result.type !== 'session') throw new Error('Unexpected provider login response.')
  return result.session
}

export function providerAuthError(failure: unknown) {
  return failure instanceof Error ? failure.message : 'Provider account request failed.'
}
