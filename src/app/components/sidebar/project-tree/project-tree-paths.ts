const backslashPattern = /\\/g
const trailingSlashPattern = /\/+$/
const windowsDrivePrefixPattern = /^[A-Za-z]:/

function normalizeProjectPathForComparison(projectId: string) {
  const normalized = projectId.replace(backslashPattern, '/').replace(trailingSlashPattern, '')

  if (windowsDrivePrefixPattern.test(normalized)) {
    return normalized.toLowerCase()
  }

  return normalized || '/'
}

export function isProtectedProjectDeletionTarget(
  projectId: string,
  protectedProjectId: string | null | undefined,
) {
  if (!protectedProjectId) {
    return false
  }

  const normalizedProjectId = normalizeProjectPathForComparison(projectId)
  const normalizedProtectedProjectId = normalizeProjectPathForComparison(protectedProjectId)

  if (normalizedProjectId === normalizedProtectedProjectId) {
    return true
  }

  if (normalizedProjectId === '/') {
    return normalizedProtectedProjectId.startsWith('/')
  }

  return normalizedProtectedProjectId.startsWith(`${normalizedProjectId}/`)
}
