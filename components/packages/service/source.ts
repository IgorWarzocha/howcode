import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const npmSpecification = /^(@[\w.-]+\/[\w.-]+|[\w.-]+)(?:@([^\s/:]+))?$/
const protocol = /^[a-z][a-z0-9+.-]*:/i
const trailingSlash = /\/$/
const gitSuffix = /\.git$/

export function packageSourceId(source: string, cwd: string) {
  return createHash('sha256').update(parsePackageSource(source, cwd).identity).digest('hex')
}

export type PackageSource =
  | { kind: 'npm'; source: string; identity: string; spec: string; name: string }
  | { kind: 'git'; source: string; identity: string; url: string; ref?: string }
  | { kind: 'local'; source: string; identity: string; root: string }

export function parsePackageSource(source: string, cwd: string): PackageSource {
  if (!source.trim() || source !== source.trim() || source.includes('\0')) {
    throw new Error('Package source must be a nonempty path or specification')
  }
  if (source.startsWith('npm:')) {
    const spec = source.slice(4)
    const match = npmSpecification.exec(spec)
    const name = match?.[1]
    if (!name) throw new Error(`Invalid npm package source: ${source}`)
    return { kind: 'npm', source, spec, name, identity: `npm:${name}` }
  }
  if (source.startsWith('git:') || source.startsWith('https://')) {
    return parseGitSource(source)
  }
  if (protocol.test(source)) throw new Error(`Unsupported package source: ${source}`)
  const root = resolve(cwd, source.startsWith('~/') ? resolve(homedir(), source.slice(2)) : source)
  return { kind: 'local', source: root, identity: root, root }
}

function parseGitSource(source: string): PackageSource {
  let url = source.startsWith('git:') ? source.slice(4) : source
  if (!url.startsWith('https://')) url = `https://${url}`
  const at = url.lastIndexOf('@')
  const ref = at > url.indexOf('/', 8) ? url.slice(at + 1) : undefined
  if (ref !== undefined) url = url.slice(0, at)
  const parsed = new URL(url)
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname.split('/').filter(Boolean).length < 2 ||
    ref === '' ||
    ref?.startsWith('-')
  ) {
    throw new Error(`Invalid git package source: ${source}`)
  }
  url = url.replace(trailingSlash, '').replace(gitSuffix, '')
  return {
    kind: 'git',
    source,
    identity: `git:${url}`,
    url,
    ...(ref === undefined ? {} : { ref }),
  }
}
