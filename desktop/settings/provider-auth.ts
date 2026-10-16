import { randomUUID } from 'node:crypto'
import path from 'node:path'
import * as Schema from 'effect/Schema'
import { ProviderAuthRequest, type ProviderAuthResponse } from '../../shared/provider-auth.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { FileCredentialStore } from './credentials.ts'
import { getDurableModels } from './models.ts'
import { getAgentDirectory } from './paths.ts'
import { getProviderAuthDeviceId } from './provider-auth-device.ts'
import { ProviderLoginSession } from './provider-auth-session.ts'

let session: ProviderLoginSession | undefined
let mutating = false
let logoutTask: Promise<ProviderAuthResponse> | undefined

async function listAccounts(): Promise<ProviderAuthResponse> {
  const directory = getAgentDirectory()
  const [models, stored] = await Promise.all([
    getDurableModels(),
    new FileCredentialStore(path.join(directory, 'auth.json')).list(),
  ])
  const accounts = await Promise.all(
    models.getProviders().map(async (provider) => {
      const status = await models.checkAuth(provider.id, { signal: AbortSignal.timeout(15_000) })
      return {
        id: provider.id,
        name: provider.name,
        available: true,
        methods: [
          ...(provider.auth.oauth
            ? [
                {
                  type: 'oauth' as const,
                  label: provider.auth.oauth.loginLabel ?? provider.auth.oauth.name,
                },
              ]
            : []),
          ...(provider.auth.apiKey?.login
            ? [{ type: 'api_key' as const, label: provider.auth.apiKey.name }]
            : []),
        ],
        source: status ? (status.source ?? status.type) : null,
        stored: stored.some((credential) => credential.providerId === provider.id),
      }
    }),
  )
  for (const credential of stored) {
    if (!models.getProvider(credential.providerId))
      accounts.push({
        id: credential.providerId,
        name: credential.providerId,
        available: false,
        methods: [],
        source: null,
        stored: true,
      })
  }
  return {
    type: 'accounts',
    directory,
    accounts: accounts.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

async function runLogin(
  login: ProviderLoginSession,
  request: Extract<ProviderAuthRequest, { operation: 'start' }>,
) {
  try {
    const models = await getDurableModels()
    const provider = models.getProvider(request.provider)
    if (
      !provider ||
      (request.authType === 'oauth' ? !provider.auth.oauth : !provider.auth.apiKey?.login)
    )
      throw new Error('This provider does not offer that login method.')
    await models.login(
      request.provider,
      request.authType,
      {
        signal: login.controller.signal,
        prompt: (prompt) => login.prompt(prompt),
        notify: (event) => login.notify(event),
      },
      { agentName: 'Howcode', getDeviceId: getProviderAuthDeviceId },
    )
    // Credentials stay here: Models.login's return value must never cross IPC.
    const refreshed = await models
      .refresh({
        providers: [request.provider],
        signal: AbortSignal.timeout(15_000),
      })
      .catch(() => null)
    login.finish(
      'success',
      !refreshed || refreshed.aborted || refreshed.errors.size > 0
        ? `Signed in to ${provider.name}, but its model catalogue could not be refreshed.`
        : `Signed in to ${provider.name}.`,
    )
    emitDesktopEvent({ type: 'shell-state-refresh' })
  } catch {
    // Provider errors can contain token responses or submitted secrets.
    login.finish('error', 'Sign-in failed. Check your details and try again.')
  } finally {
    mutating = false
  }
}

function startLogin(request: Extract<ProviderAuthRequest, { operation: 'start' }>) {
  if (mutating) throw new Error('Another provider account operation is in progress.')
  mutating = true
  session?.dispose()
  const login = new ProviderLoginSession(randomUUID(), () => {
    // Keep the mutation reservation until the provider has actually stopped.
    void login.completion.then(() => {
      if (session === login) session = undefined
    })
  })
  session = login
  login.completion = runLogin(login, request)
  return { type: 'session' as const, session: login.state }
}

async function logout(provider: string): Promise<ProviderAuthResponse> {
  try {
    await (await getDurableModels()).logout(provider)
    emitDesktopEvent({ type: 'shell-state-refresh' })
    return await listAccounts()
  } catch {
    throw new Error(
      'Could not update provider accounts. Check the Pi credential configuration on the server.',
    )
  } finally {
    mutating = false
  }
}

export async function providerAuth(input: ProviderAuthRequest): Promise<ProviderAuthResponse> {
  // Do not include a malformed secret-bearing payload in validation errors or logs.
  const decoded = Schema.decodeUnknownOption(ProviderAuthRequest)(input)
  if (decoded._tag === 'None') throw new Error('Invalid provider account request.')
  const request = decoded.value
  if (request.operation === 'list')
    return listAccounts().catch(() => {
      throw new Error(
        'Could not read provider accounts. Check the Pi credential configuration on the server.',
      )
    })
  if (request.operation === 'start') return startLogin(request)
  if (request.operation === 'logout') {
    if (mutating) throw new Error('Another provider account operation is in progress.')
    mutating = true
    logoutTask = logout(request.provider)
    try {
      return await logoutTask
    } finally {
      logoutTask = undefined
    }
  }
  const login = session
  if (!login || login.id !== request.sessionId) throw new Error('This login session has expired.')
  login.touch()
  if (request.operation === 'answer') login.answer(request.promptId, request.value)
  if (request.operation === 'cancel') login.cancel()
  return { type: 'session', session: login.state }
}

export async function disposeProviderAuth() {
  const login = session
  login?.dispose()
  await Promise.all([login?.completion, logoutTask])
  if (session === login) session = undefined
}
