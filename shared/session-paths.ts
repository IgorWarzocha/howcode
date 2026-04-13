const LOCAL_SESSION_PREFIX = "local://";
const DEFAULT_LOCAL_DRAFT_TOKEN = "new-thread";

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

export function createLocalThreadDraft(projectId: string, token = DEFAULT_LOCAL_DRAFT_TOKEN) {
  const encodedProjectId = encodeURIComponent(projectId);

  return {
    projectId,
    threadId: `local-thread-${token}`,
    sessionPath: `${LOCAL_SESSION_PREFIX}${encodedProjectId}/${token}`,
  };
}
