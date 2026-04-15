function normalizeProjectPathForComparison(projectId: string) {
  const normalized = projectId.replace(/\\/g, "/").replace(/\/+$/, "");

  if (/^[A-Za-z]:/.test(normalized)) {
    return normalized.toLowerCase();
  }

  return normalized || "/";
}

export function isProtectedProjectDeletionTarget(
  projectId: string,
  protectedProjectId: string | null | undefined,
) {
  if (!protectedProjectId) {
    return false;
  }

  const normalizedProjectId = normalizeProjectPathForComparison(projectId);
  const normalizedProtectedProjectId = normalizeProjectPathForComparison(protectedProjectId);

  if (normalizedProjectId === normalizedProtectedProjectId) {
    return true;
  }

  if (normalizedProjectId === "/") {
    return normalizedProtectedProjectId.startsWith("/");
  }

  return normalizedProtectedProjectId.startsWith(`${normalizedProjectId}/`);
}
