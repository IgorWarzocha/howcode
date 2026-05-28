const invalidBranchNameCharacters = new Set(['~', '^', ':', '?', '*', '[', '\\'])
const repeatedDashPattern = /-+/g
const repeatedSlashPattern = /\/+/g
const lockSuffixPattern = /\.lock$/i
const repeatedDotPattern = /\.\.+/g
const leadingDotPattern = /^\.+/
const trailingDotPattern = /\.+$/
const edgeDashPattern = /^-|-$/g

function normalizeBranchSegment(segment: string) {
  return segment
    .split('')
    .map((character) =>
      character.charCodeAt(0) <= 32 ||
      character.charCodeAt(0) === 127 ||
      invalidBranchNameCharacters.has(character)
        ? '-'
        : character,
    )
    .join('')
    .replaceAll(repeatedDotPattern, '-')
    .replace(lockSuffixPattern, '')
    .replace(leadingDotPattern, '')
    .replace(trailingDotPattern, '')
    .replaceAll(repeatedDashPattern, '-')
    .replace(edgeDashPattern, '')
}

export function normalizeGitBranchName(input: string) {
  const normalized = input
    .trim()
    .replaceAll('@{', '-')
    .replaceAll(repeatedSlashPattern, '/')
    .split('/')
    .map(normalizeBranchSegment)
    .filter((segment) => segment.length > 0)
    .join('/')
    .replace(trailingDotPattern, '')

  if (!normalized || normalized === 'HEAD') return 'branch'
  if (normalized.startsWith('-')) return `branch${normalized}`
  return normalized
}
