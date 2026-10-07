import { randomBytes } from 'node:crypto'

export type HeadlessServerOptions = {
  dataPath: string | null
  host: string
  port: number
  accessToken: string | null
  authRequired: boolean
}

const DEFAULT_HEADLESS_HOST = '127.0.0.1'
const DEFAULT_HEADLESS_PORT = 5173
const HEADLESS_HOST_ENV = 'HOWCODE_HEADLESS_HOST'
const HEADLESS_PORT_ENV = 'HOWCODE_HEADLESS_PORT'
const HEADLESS_TOKEN_ENV = 'HOWCODE_HEADLESS_TOKEN'

function readOptionValue(args: readonly string[], name: string) {
  const inlinePrefix = `${name}=`
  const inlineArg = args.find((arg) => arg.startsWith(inlinePrefix))
  if (inlineArg) {
    return inlineArg.slice(inlinePrefix.length)
  }

  const index = args.indexOf(name)
  if (index === -1) {
    return null
  }

  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}.`)
  return value
}

function parsePort(value: string | null | undefined) {
  if (value == null) return null
  const parsedPort = Number(value)
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535)
    throw new Error(`Invalid server port: ${value}`)
  return parsedPort
}

function isRemoteHeadlessHost(host: string) {
  return host !== '127.0.0.1' && host !== 'localhost' && host !== '::1'
}

function createAccessToken() {
  return `hc_${randomBytes(18).toString('base64url')}`
}

export function parseHeadlessServerOptions(
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): HeadlessServerOptions {
  const host =
    readOptionValue(args, '--host')?.trim() || env[HEADLESS_HOST_ENV] || DEFAULT_HEADLESS_HOST
  const port =
    parsePort(readOptionValue(args, '--port')) ??
    parsePort(env[HEADLESS_PORT_ENV]) ??
    DEFAULT_HEADLESS_PORT
  const authRequired =
    isRemoteHeadlessHost(host) ||
    Boolean(readOptionValue(args, '--token')?.trim() || env[HEADLESS_TOKEN_ENV]?.trim())
  const accessToken =
    readOptionValue(args, '--token')?.trim() ||
    env[HEADLESS_TOKEN_ENV]?.trim() ||
    (authRequired ? createAccessToken() : null)

  const { HOWCODE_USER_DATA_PATH: configuredDataPath } = env
  return {
    dataPath: readOptionValue(args, '--data-path')?.trim() || configuredDataPath?.trim() || null,
    host,
    port,
    accessToken,
    authRequired,
  }
}

export function getHeadlessAccessUrl(
  options: Pick<HeadlessServerOptions, 'host' | 'port'> &
    Partial<Pick<HeadlessServerOptions, 'accessToken' | 'authRequired'>>,
) {
  const accessHost =
    options.host === '0.0.0.0' || options.host === '::' ? '127.0.0.1' : options.host
  const tokenFragment =
    options.authRequired && options.accessToken
      ? `#token=${encodeURIComponent(options.accessToken)}`
      : ''
  return `http://${accessHost.includes(':') ? `[${accessHost}]` : accessHost}:${options.port}${tokenFragment}`
}
