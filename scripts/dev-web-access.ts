import { randomBytes } from 'node:crypto'
import type http from 'node:http'
import {
  createHeadlessAuthState,
  handleHeadlessAuthRequest,
  hasAuthenticatedSession,
  hasTrustedBrowserOrigin,
} from '../src/server/auth'
import { sendJson, sendText } from '../src/server/http-response'
import { authoriseMcpRequest } from '../src/server/mcp-auth'

type RendererTrust = { hosts: Set<string>; port: number }

export function createDevWebAccess(options: {
  allowRemoteRendererHosts: boolean
  configuredAccessToken: string | null
}) {
  const authRequired = options.allowRemoteRendererHosts || Boolean(options.configuredAccessToken)
  const accessToken = options.configuredAccessToken || `hc_${randomBytes(18).toString('base64url')}`
  const auth = createHeadlessAuthState({ accessToken, authRequired, port: 0 })
  let rendererTrust: RendererTrust | null = null
  const isTrustedRendererHost = (host: string | undefined) => {
    if (!(rendererTrust && host)) return false
    if (rendererTrust.hosts.has(host)) return true
    try {
      return (
        options.allowRemoteRendererHosts &&
        Number(new URL(`http://${host}`).port) === rendererTrust.port
      )
    } catch {
      return false
    }
  }
  return {
    accessToken,
    authRequired,
    configureRendererTrust: (trust: RendererTrust) => {
      rendererTrust = trust
      auth.cookieName = `howcode_dev_web_session_${trust.port}`
    },
    handleAuthRequest: (request: http.IncomingMessage, response: http.ServerResponse) =>
      handleHeadlessAuthRequest(request, response, auth, isTrustedRendererHost, 16 * 1024),
    authoriseMcpRequest: (request: http.IncomingMessage, response: http.ServerResponse) =>
      authoriseMcpRequest(request, response, accessToken, (host) =>
        Boolean(
          rendererTrust &&
            host &&
            (rendererTrust.hosts.has(host) ||
              host === `localhost:${rendererTrust.port}` ||
              host === `[::1]:${rendererTrust.port}`),
        ),
      ),
    authoriseBridgeRequest: (request: http.IncomingMessage, response: http.ServerResponse) => {
      if (!hasTrustedBrowserOrigin(request, isTrustedRendererHost)) {
        sendText(response, 403, 'Forbidden')
        return false
      }
      if (!hasAuthenticatedSession(request, auth)) {
        sendJson(response, 401, { error: 'Headless access token required.' })
        return false
      }
      return true
    },
  }
}
