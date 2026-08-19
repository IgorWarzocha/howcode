import crypto from 'node:crypto'
import type http from 'node:http'

type RendererTrust = { hosts: Set<string>; port: number }

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.length
    if (byteLength > 16 * 1024) throw new Error('Request body is too large.')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
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
      // Ignore malformed cookie values instead of crashing the dev server.
    }
  }
  return cookies
}

function getHostPort(host: string) {
  try {
    const parsedHost = new URL(`http://${host}`)
    return parsedHost.port ? Number(parsedHost.port) : null
  } catch {
    return null
  }
}

export function createDevWebAccess(options: {
  allowRemoteRendererHosts: boolean
  configuredAccessToken: string | null
}) {
  const authRequired = options.allowRemoteRendererHosts
  const accessToken =
    options.configuredAccessToken ||
    (authRequired ? `hc_${crypto.randomBytes(18).toString('base64url')}` : null)
  const sessionToken = crypto.randomUUID()
  let rendererTrust: RendererTrust | null = null

  const getSessionCookieName = () => `howcode_dev_web_session_${rendererTrust?.port ?? 'pending'}`

  const isTrustedRendererHost = (host: string) => {
    if (!rendererTrust) return false
    if (rendererTrust.hosts.has(host)) return true
    return options.allowRemoteRendererHosts && getHostPort(host) === rendererTrust.port
  }

  const isTrustedBrowserRequest = (request: http.IncomingMessage) => {
    if (!rendererTrust) return false
    const requestHost = request.headers.host
    if (typeof requestHost !== 'string' || !isTrustedRendererHost(requestHost)) return false
    const origin = request.headers.origin
    if (typeof origin !== 'string') return true
    try {
      return isTrustedRendererHost(new URL(origin).host)
    } catch {
      return false
    }
  }

  const hasAuthenticatedSession = (request: http.IncomingMessage) => {
    if (!authRequired) return true
    return parseCookieHeader(request.headers.cookie).get(getSessionCookieName()) === sessionToken
  }

  const handleAuthRequest = async (
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) => {
    if (!isTrustedBrowserRequest(request)) {
      response.statusCode = 403
      response.end('Forbidden')
      return
    }
    if (request.method === 'GET') {
      sendJson(response, 200, {
        required: authRequired,
        authenticated: hasAuthenticatedSession(request),
      })
      return
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Auth requests must use GET or POST.' })
      return
    }
    if (!authRequired) {
      sendJson(response, 200, { authenticated: true, required: false })
      return
    }
    const body = (await readJsonBody(request).catch(() => null)) as { token?: unknown } | null
    if (typeof body?.token !== 'string' || body.token !== accessToken) {
      sendJson(response, 401, { error: 'Invalid access token.' })
      return
    }
    response.setHeader(
      'set-cookie',
      `${getSessionCookieName()}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax`,
    )
    sendJson(response, 200, { authenticated: true, required: true })
  }

  const authoriseBridgeRequest = (request: http.IncomingMessage, response: http.ServerResponse) => {
    if (!isTrustedBrowserRequest(request)) {
      response.statusCode = 403
      response.end('Forbidden')
      return false
    }
    if (!hasAuthenticatedSession(request)) {
      sendJson(response, 401, { error: 'Headless access token required.' })
      return false
    }
    return true
  }

  return {
    accessToken,
    authRequired,
    authoriseBridgeRequest,
    configureRendererTrust: (trust: RendererTrust) => {
      rendererTrust = trust
    },
    handleAuthRequest,
  }
}
