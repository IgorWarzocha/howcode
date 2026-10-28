import { prerelease, valid, validRange } from 'semver'

export type ReleaseChannel = 'main' | 'dev' | 'durable'

export function releaseVersion(channel: ReleaseChannel, declared: string, explicit?: string) {
  const version = explicit ?? declared
  if (valid(version) !== version || version.includes('+')) {
    throw new Error(`Release version must be an exact SemVer without build metadata: ${version}`)
  }
  const identifiers = prerelease(version)
  if (channel !== 'main') {
    if (!explicit || identifiers?.[0] !== channel || identifiers.length < 2) {
      throw new Error(`${channel} releases require an explicit version such as 0.2.0-${channel}.1`)
    }
  } else if (identifiers || version !== declared) {
    throw new Error(`Stable releases must match packages/howcode/package.json (${declared})`)
  }
  return version
}

export function releaseDependencies(
  declared: Record<string, string>,
  rootDependencies: Record<string, string>,
  components: string[],
) {
  const dependencies: Record<string, string> = {}
  const invalid: string[] = []
  for (const name of new Set([...Object.keys(declared), ...components])) {
    const version = rootDependencies[name] ?? declared[name]
    if (!(version && validRange(version))) {
      invalid.push(`${name}@${version ?? '(missing)'}`)
      continue
    }
    dependencies[name] = version
  }
  if (invalid.length > 0) {
    throw new Error(
      `Release requires registry dependency versions or ranges; adopt published packages first:\n${invalid.join('\n')}`,
    )
  }
  return dependencies
}
