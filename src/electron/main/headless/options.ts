export type HeadlessServerOptions = {
  enabled: boolean
  host: string
  port: number
}

const DEFAULT_HEADLESS_HOST = '127.0.0.1'
const DEFAULT_HEADLESS_PORT = 5173
const HEADLESS_ENV = 'HOWCODE_HEADLESS'
const HEADLESS_HOST_ENV = 'HOWCODE_HEADLESS_HOST'
const HEADLESS_PORT_ENV = 'HOWCODE_HEADLESS_PORT'

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
  return value && !value.startsWith('--') ? value : null
}

function parsePort(value: string | null | undefined) {
  const parsedPort = Number(value)
  return Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65_535 ? parsedPort : null
}

function isHeadlessRequested(args: readonly string[], env: NodeJS.ProcessEnv) {
  return args.includes('--headless') || env[HEADLESS_ENV] === '1'
}

export function parseHeadlessServerOptions(
  args: readonly string[] = process.argv.slice(1),
  env: NodeJS.ProcessEnv = process.env,
): HeadlessServerOptions {
  const host =
    readOptionValue(args, '--host')?.trim() || env[HEADLESS_HOST_ENV] || DEFAULT_HEADLESS_HOST
  const port =
    parsePort(readOptionValue(args, '--port')) ??
    parsePort(env[HEADLESS_PORT_ENV]) ??
    DEFAULT_HEADLESS_PORT

  return {
    enabled: isHeadlessRequested(args, env),
    host,
    port,
  }
}

export function getHeadlessAccessUrl(options: Pick<HeadlessServerOptions, 'host' | 'port'>) {
  const accessHost =
    options.host === '0.0.0.0' || options.host === '::' ? '127.0.0.1' : options.host
  return `http://${accessHost}:${options.port}`
}
