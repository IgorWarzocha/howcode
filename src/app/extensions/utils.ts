import { getSafeExternalUrl, pickSafeExternalUrl } from '@howcode/shared/external-url'
import type { PiConfiguredPackage } from '../desktop/types'
import { canSearchPiPackagesQuery, openExternalQuery } from '../query/desktop-query'
import { getActionError } from '../utils/action-error'

const compactNumberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const gitSuffixPattern = /\.git$/i
const sshGitSourcePattern = /^git@[^:]+:.+/
const shorthandGitSourcePattern = /^[\w.-]+\/[\w./-]+$/

export { getActionError, getSafeExternalUrl, pickSafeExternalUrl }

export function formatDownloads(downloads: number) {
  return `${compactNumberFormatter.format(downloads)}/mo`
}

export function isDesktopPackagesAvailable() {
  return canSearchPiPackagesQuery()
}

export async function openExternalUrl(url: string) {
  const safeUrl = getSafeExternalUrl(url)
  if (!safeUrl) {
    return false
  }

  if (await openExternalQuery(safeUrl)) return true

  window.open(safeUrl, '_blank', 'noopener,noreferrer')
  return true
}

export function getInstalledIdentityKeys(packages: PiConfiguredPackage[]) {
  return new Set(
    packages
      .filter(
        (configuredPackage) =>
          configuredPackage.resourceKind === 'package' &&
          typeof configuredPackage.installedPath === 'string',
      )
      .map((configuredPackage) => configuredPackage.identityKey),
  )
}

export function getConfiguredSourceLabel(configuredPackage: PiConfiguredPackage) {
  if (configuredPackage.type === 'local') {
    return configuredPackage.source
  }

  return configuredPackage.type
}

function stripGitRef(source: string) {
  const lastAtIndex = source.lastIndexOf('@')
  const lastPathSeparatorIndex = Math.max(source.lastIndexOf('/'), source.lastIndexOf(':'))
  return lastAtIndex > lastPathSeparatorIndex ? source.slice(0, lastAtIndex) : source
}

function normalizeGitRepositoryUrl(source: string) {
  const withoutPrefix = source.startsWith('git:') ? source.slice(4) : source
  const withoutRef = stripGitRef(withoutPrefix).replace(gitSuffixPattern, '')

  if (sshGitSourcePattern.test(withoutRef)) {
    const [host = '', repo = ''] = withoutRef.slice(4).split(':')
    return host && repo ? `https://${host}/${repo}` : null
  }

  if (shorthandGitSourcePattern.test(withoutRef)) {
    return `https://${withoutRef}`
  }

  return getSafeExternalUrl(withoutRef)
}

export function getConfiguredPackageExternalUrl(configuredPackage: PiConfiguredPackage) {
  if (configuredPackage.type === 'npm') {
    const packageName = configuredPackage.source.startsWith('npm:')
      ? configuredPackage.source.slice(4)
      : configuredPackage.source
    return getSafeExternalUrl(`https://www.npmjs.com/package/${packageName}`)
  }

  if (configuredPackage.type === 'git') {
    return normalizeGitRepositoryUrl(configuredPackage.source)
  }

  return null
}

export function isConfiguredSourcePath(configuredPackage: PiConfiguredPackage) {
  return configuredPackage.type === 'local'
}
