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

export function createLocalThreadDraft(projectId: string, token = buildLocalSessionToken()) {
  const encodedProjectId = encodeURIComponent(projectId);

  return {
    projectId,
    threadId: `local-thread-${token}`,
    sessionPath: `${LOCAL_SESSION_PREFIX}${encodedProjectId}/${token}`,
  };
}
