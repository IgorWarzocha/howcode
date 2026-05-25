const LOCAL_SESSION_PREFIX = 'local://'
const localSessionPathPattern = /^local:\/\/([^/]+)\/[^?]+(?:\?(.+))?$/

function buildLocalSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isLocalSessionPath(sessionPath: string | null | undefined) {
  return typeof sessionPath === 'string' && sessionPath.startsWith(LOCAL_SESSION_PREFIX)
}

export function getPersistedSessionPath(sessionPath: string | null | undefined) {
  return typeof sessionPath === 'string' &&
    sessionPath.length > 0 &&
    !isLocalSessionPath(sessionPath)
    ? sessionPath
    : null
}

function getLocalDraftParts(sessionPath: string | null | undefined) {
  if (typeof sessionPath !== 'string' || !isLocalSessionPath(sessionPath)) {
    return null
  }

  const [, encodedProjectId = '', query = ''] = sessionPath.match(localSessionPathPattern) ?? []
  if (encodedProjectId.length === 0) {
    return null
  }

  try {
    const params = new URLSearchParams(query)
    return {
      projectId: decodeURIComponent(encodedProjectId),
      chatGroupId: params.get('chatGroupId'),
      branchName: params.get('branchName'),
    }
  } catch {
    return null
  }
}

export function getLocalDraftProjectId(sessionPath: string | null | undefined) {
  return getLocalDraftParts(sessionPath)?.projectId ?? null
}

export function getLocalDraftChatGroupId(sessionPath: string | null | undefined) {
  return getLocalDraftParts(sessionPath)?.chatGroupId ?? null
}

export function getLocalDraftBranchName(sessionPath: string | null | undefined) {
  return getLocalDraftParts(sessionPath)?.branchName ?? null
}

export function createLocalThreadDraft(
  projectId: string,
  token = buildLocalSessionToken(),
  options: {
    chatGroupId?: string | undefined | null | undefined
    branchName?: string | undefined | null | undefined
  } = {},
) {
  const encodedProjectId = encodeURIComponent(projectId)
  const params = new URLSearchParams()
  if (options.chatGroupId) params.set('chatGroupId', options.chatGroupId)
  if (options.branchName) params.set('branchName', options.branchName)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''

  return {
    projectId,
    threadId: `local-thread-${token}`,
    sessionPath: `${LOCAL_SESSION_PREFIX}${encodedProjectId}/${token}${suffix}`,
  }
}
