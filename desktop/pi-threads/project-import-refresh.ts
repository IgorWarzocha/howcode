export type ProjectImportRefreshMode = "scan" | "import";

export function getProjectImportRefreshError({
  mode,
  projectIds,
  refreshed,
}: {
  mode: ProjectImportRefreshMode;
  projectIds: string[];
  refreshed: boolean;
}) {
  if (refreshed || projectIds.length > 0) {
    return null;
  }

  return mode === "scan"
    ? "Could not refresh Pi sessions before scanning projects."
    : "Could not refresh Pi sessions before importing projects.";
}
