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

  const [, encodedProjectId = '', query = ''] =
    conversationId.match(localConversationIdPattern) ?? []
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

export function getLocalDraftProjectId(conversationId: string | null | undefined) {
  return getLocalDraftParts(conversationId)?.projectId ?? null
}

export function getLocalDraftChatGroupId(conversationId: string | null | undefined) {
  return getLocalDraftParts(conversationId)?.chatGroupId ?? null
}

export function getLocalDraftBranchName(conversationId: string | null | undefined) {
  return getLocalDraftParts(conversationId)?.branchName ?? null
}

export function createLocalThreadDraft(
  projectId: string,
  token = buildLocalConversationToken(),
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
    conversationId: `${LOCAL_CONVERSATION_PREFIX}${encodedProjectId}/${token}${suffix}`,
  }
}
