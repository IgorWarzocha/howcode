import { randomUUID } from 'node:crypto'
import type http from 'node:http'
import { isDevServerLoopbackHost, isDevServerWildcardHost } from '../../../../shared/dev-server'
import { readJsonBody, sendJson, sendText } from './http-response'
import type { HeadlessServerOptions } from './options'

export type HeadlessAuthState = {
  accessToken: string | null
  cookieName: string
  required: boolean
  sessionToken: string
}

function parseCookieHeader(cookieHeader: string | string[] | undefined) {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader
  const cookies = new Map<string, string>()
  if (!header) return cookies
  for (const part of header.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=')
    if (!rawName) continue
    try {
      cookies.set(rawName, decodeURIComponent(rawValueParts.join('=')))
    } catch {
      // Ignore malformed cookie values instead of taking down the headless server.
    }
  }
  return cookies
}

export function createHeadlessAuthState(
  options: Pick<HeadlessServerOptions, 'accessToken' | 'authRequired' | 'port'>,
): HeadlessAuthState {
  return {
    accessToken: options.accessToken,
    cookieName: `howcode_headless_session_${options.port}`,
    required: options.authRequired,
    sessionToken: randomUUID(),
  }
}

export function hasAuthenticatedSession(request: http.IncomingMessage, auth: HeadlessAuthState) {
  if (!auth.required) return true
  return parseCookieHeader(request.headers.cookie).get(auth.cookieName) === auth.sessionToken
}

function getHostPort(host: string) {
  try {
    const parsedHost = new URL(`http://${host}`)
    return parsedHost.port ? Number(parsedHost.port) : null
  } catch {
    return null
  }
}

export function createHostTrust(options: Pick<HeadlessServerOptions, 'host' | 'port'>) {
  const trustedHosts = new Set([
    `127.0.0.1:${options.port}`,
    `localhost:${options.port}`,
    `${options.host}:${options.port}`,
  ])
  const allowAnyHostOnPort =
    isDevServerWildcardHost(options.host) || !isDevServerLoopbackHost(options.host)

  return (host: string | undefined) => {
    if (!host) return false
    if (trustedHosts.has(host)) return true
    return allowAnyHostOnPort && getHostPort(host) === options.port
  }
}

export function hasTrustedBrowserOrigin(
  request: http.IncomingMessage,
  isTrustedHost: (host: string | undefined) => boolean,
) {
  if (!isTrustedHost(request.headers.host)) return false
  const origin = request.headers.origin
  if (typeof origin !== 'string') return true
  try {
    return isTrustedHost(new URL(origin).host)
  } catch {
    return false
  }
}

function setAuthenticatedSessionCookie(response: http.ServerResponse, auth: HeadlessAuthState) {
  response.setHeader(
    'set-cookie',
    `${auth.cookieName}=${encodeURIComponent(auth.sessionToken)}; Path=/; HttpOnly; SameSite=Lax`,
  )
}

export async function handleHeadlessAuthRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  auth: HeadlessAuthState,
  isTrustedHost: (host: string | undefined) => boolean,
) {
  if (!hasTrustedBrowserOrigin(request, isTrustedHost)) {
    sendText(response, 403, 'Forbidden')
    return
  }
  if (request.method === 'GET') {
    sendJson(response, 200, {
      required: auth.required,
      authenticated: hasAuthenticatedSession(request, auth),
    })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Auth requests must use GET or POST.' })
    return
  }
  if (!auth.required) {
    sendJson(response, 200, { authenticated: true, required: false })
    return
  }
  const body = (await readJsonBody(request).catch(() => null)) as { token?: unknown } | null
  if (typeof body?.token !== 'string' || body.token !== auth.accessToken) {
    sendJson(response, 401, { error: 'Invalid access token.' })
    return
  }
  setAuthenticatedSessionCookie(response, auth)
  sendJson(response, 200, { authenticated: true, required: true })
}
