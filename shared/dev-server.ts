import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const DEV_SERVER_HOST = '127.0.0.1'
export const DEV_SERVER_START_PORT = 5173
export const DEV_SERVER_METADATA_RELATIVE_PATH = path.join('build', 'dev-server.json')
export const DEV_SERVER_HOST_ENV = 'HOWCODE_DEV_SERVER_HOST'
export const DEV_SERVER_PUBLIC_HOST_ENV = 'HOWCODE_DEV_SERVER_PUBLIC_HOST'

const wildcardHosts = new Set(['0.0.0.0', '::', '[::]'])
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

const REPO_ROOT_MARKERS = ['package.json', 'tsconfig.json'] as const

function hasRepoRootMarkers(candidatePath: string) {
  return REPO_ROOT_MARKERS.every((entry) => existsSync(path.join(candidatePath, entry)))
}

function normalizeSearchStartPath(candidatePath: string) {
  const trimmedPath = candidatePath.trim()
  if (trimmedPath.length === 0) {
    return null
  }

  const resolvedPath = path.resolve(trimmedPath)
  if (!existsSync(resolvedPath)) {
    return path.dirname(resolvedPath)
  }

  return statSync(resolvedPath).isDirectory() ? resolvedPath : path.dirname(resolvedPath)
}

export function resolveRepoRoot(searchStartPaths: readonly string[]) {
  for (const candidatePath of searchStartPaths) {
    const normalizedStartPath = normalizeSearchStartPath(candidatePath)
    if (!normalizedStartPath) {
      continue
    }

    let currentPath = normalizedStartPath

    while (true) {
      if (hasRepoRootMarkers(currentPath)) {
        return currentPath
      }

      const parentPath = path.dirname(currentPath)
      if (parentPath === currentPath) {
        break
      }

      currentPath = parentPath
    }
  }

  return null
}

export function resolveDevServerMetadataPath(searchStartPaths: readonly string[]) {
  const repoRootPath = resolveRepoRoot(searchStartPaths)
  return repoRootPath ? path.join(repoRootPath, DEV_SERVER_METADATA_RELATIVE_PATH) : null
}

export function parseDevServerMetadata(rawMetadata: string) {
  const parsedMetadata = JSON.parse(rawMetadata) as {
    host?: unknown
    port?: unknown
    url?: unknown
  }

  if (typeof parsedMetadata.url === 'string' && parsedMetadata.url.length > 0) {
    return parsedMetadata.url
  }

  if (typeof parsedMetadata.host === 'string' && typeof parsedMetadata.port === 'number') {
    return `http://${parsedMetadata.host}:${parsedMetadata.port}`
  }

  return null
}

function normalizeDevServerHost(host: string | null | undefined) {
  const trimmedHost = host?.trim() ?? ''
  if (trimmedHost.length === 0) {
    return null
  }

  if (trimmedHost.includes('://') || trimmedHost.includes('/') || trimmedHost.includes(' ')) {
    return null
  }

  return trimmedHost
}

export function resolveDevServerListenHost(env: NodeJS.ProcessEnv = process.env) {
  return normalizeDevServerHost(env[DEV_SERVER_HOST_ENV]) ?? DEV_SERVER_HOST
}

export function resolveDevServerPublicHost(
  listenHost: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const configuredPublicHost = normalizeDevServerHost(env[DEV_SERVER_PUBLIC_HOST_ENV])
  if (configuredPublicHost) {
    return configuredPublicHost
  }

  return wildcardHosts.has(listenHost) ? DEV_SERVER_HOST : listenHost
}

export function isDevServerWildcardHost(host: string) {
  return wildcardHosts.has(host)
}

export function isDevServerLoopbackHost(host: string) {
  return loopbackHosts.has(host)
}

export function resolveConfiguredDevServerUrl(searchStartPaths: readonly string[]) {
  const metadataPath = resolveDevServerMetadataPath(searchStartPaths)
  if (!metadataPath) {
    return null
  }

  try {
    return parseDevServerMetadata(readFileSync(metadataPath, 'utf8'))
  } catch {
    return null
  }
}
