const LOCAL_SESSION_PREFIX = "local://";

function buildLocalSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isLocalSessionPath(sessionPath: string | null | undefined) {
  return typeof sessionPath === "string" && sessionPath.startsWith(LOCAL_SESSION_PREFIX);
}

export function getPersistedSessionPath(sessionPath: string | null | undefined) {
  return typeof sessionPath === "string" &&
    sessionPath.length > 0 &&
    !isLocalSessionPath(sessionPath)
    ? sessionPath
    : null;
}

function getLocalDraftParts(sessionPath: string | null | undefined) {
  if (typeof sessionPath !== "string" || !isLocalSessionPath(sessionPath)) {
    return null;
  }

  const [, encodedProjectId = "", encodedChatGroupId = ""] =
    sessionPath.match(/^local:\/\/([^/]+)\/[^?]+(?:\?chatGroupId=([^&]+))?$/) ?? [];
  if (encodedProjectId.length === 0) {
    return null;
  }

  try {
    return {
      projectId: decodeURIComponent(encodedProjectId),
      chatGroupId: encodedChatGroupId ? decodeURIComponent(encodedChatGroupId) : null,
    };
  } catch {
    return null;
  }
}

export function getLocalDraftProjectId(sessionPath: string | null | undefined) {
  return getLocalDraftParts(sessionPath)?.projectId ?? null;
}

export function getLocalDraftChatGroupId(sessionPath: string | null | undefined) {
  return getLocalDraftParts(sessionPath)?.chatGroupId ?? null;
}

export function createLocalThreadDraft(
  projectId: string,
  token = buildLocalSessionToken(),
  options: { chatGroupId?: string | null } = {},
) {
  const encodedProjectId = encodeURIComponent(projectId);
  const chatGroupSuffix = options.chatGroupId
    ? `?chatGroupId=${encodeURIComponent(options.chatGroupId)}`
    : "";

  return {
    projectId,
    threadId: `local-thread-${token}`,
    sessionPath: `${LOCAL_SESSION_PREFIX}${encodedProjectId}/${token}${chatGroupSuffix}`,
  };
}
