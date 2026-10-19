import { timingSafeEqual } from 'node:crypto'
import type http from 'node:http'
import { networkInterfaces } from 'node:os'
import { sendJson, sendText } from './http-response'

// Wildcard listeners accept local interface addresses, never arbitrary DNS names.
export function createMcpHostTrust(host: string, port: () => number) {
  const names = new Set(['localhost', '127.0.0.1', '[::1]'])
  if (host === '0.0.0.0' || host === '::') {
    for (const address of Object.values(networkInterfaces()).flatMap(
      (addresses) => addresses ?? [],
    )) {
      names.add(address.family === 'IPv6' ? `[${address.address}]` : address.address)
    }
  } else names.add(host.includes(':') && !host.startsWith('[') ? `[${host}]` : host)
  return (authority: string | undefined) => {
    if (!authority) return false
    return [...names].some((name) => authority === `${name}:${port()}`)
  }
}

export function authoriseMcpRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  accessToken: string | null,
  isTrustedHost: (host: string | undefined) => boolean,
) {
  const origin = request.headers.origin
  let trustedOrigin = origin === undefined
  if (typeof origin === 'string') {
    try {
      const parsed = new URL(origin)
      trustedOrigin =
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.origin === origin &&
        isTrustedHost(parsed.host)
    } catch {
      trustedOrigin = false
    }
  }
  if (!(isTrustedHost(request.headers.host) && trustedOrigin)) {
    sendText(response, 403, 'Forbidden')
    return false
  }
  const authorization = request.headers.authorization
  const expected = Buffer.from(`Bearer ${accessToken ?? ''}`)
  const actual = Buffer.from(authorization ?? '')
  if (!accessToken || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    response.setHeader('www-authenticate', 'Bearer realm="howcode"')
    sendJson(response, 401, { error: 'MCP requires the configured Howcode access token.' })
    return false
  }
  return true
}
