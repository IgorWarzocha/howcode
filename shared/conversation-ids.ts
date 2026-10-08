const LOCAL_CONVERSATION_PREFIX = 'local://'
const localConversationIdPattern = /^local:\/\/([^/]+)\/[^?]+(?:\?(.+))?$/

function buildLocalConversationToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isLocalConversationId(conversationId: string | null | undefined) {
  return typeof conversationId === 'string' && conversationId.startsWith(LOCAL_CONVERSATION_PREFIX)
}

export function getPersistedConversationId(conversationId: string | null | undefined) {
  return typeof conversationId === 'string' &&
    conversationId.length > 0 &&
    !isLocalConversationId(conversationId)
    ? conversationId
    : null
}

function getLocalDraftParts(conversationId: string | null | undefined) {
  if (typeof conversationId !== 'string' || !isLocalConversationId(conversationId)) {
    return null
  }

  const [, encodedDirectoryId = '', query = ''] =
    conversationId.match(localConversationIdPattern) ?? []
  if (encodedDirectoryId.length === 0) {
    return null
  }

  try {
    const params = new URLSearchParams(query)
    return {
      directoryId: decodeURIComponent(encodedDirectoryId),
      workspaceId: params.get('workspaceId') ?? params.get('chatGroupId'),
      branchName: params.get('branchName'),
    }
  } catch {
    return null
  }
}

export function getLocalDraftDirectoryId(conversationId: string | null | undefined) {
  return getLocalDraftParts(conversationId)?.directoryId ?? null
}

export function getLocalDraftWorkspaceId(conversationId: string | null | undefined) {
  return getLocalDraftParts(conversationId)?.workspaceId ?? null
}

export function getLocalDraftBranchName(conversationId: string | null | undefined) {
  return getLocalDraftParts(conversationId)?.branchName ?? null
}

export function createLocalChatDraft(
  directoryId: string,
  token = buildLocalConversationToken(),
  options: {
    workspaceId?: string | undefined | null | undefined
    branchName?: string | undefined | null | undefined
  } = {},
) {
  const encodedDirectoryId = encodeURIComponent(directoryId)
  const params = new URLSearchParams()
  if (options.workspaceId) params.set('workspaceId', options.workspaceId)
  if (options.branchName) params.set('branchName', options.branchName)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''

  return {
    directoryId,
    chatId: `local-thread-${token}`,
    conversationId: `${LOCAL_CONVERSATION_PREFIX}${encodedDirectoryId}/${token}${suffix}`,
  }
}
