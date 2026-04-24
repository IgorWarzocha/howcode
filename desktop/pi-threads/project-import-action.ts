import type { DesktopActionResultData } from "../../shared/desktop-contracts";
import {
  getProjectImportRefreshError,
  type ProjectImportRefreshMode,
} from "./project-import-refresh";

export type ProjectImportRefreshOptions = {
  emitRefreshEvent?: boolean;
};

export async function resolveProjectImportActionResult<T extends DesktopActionResultData>({
  cwd,
  mode,
  projectIds,
  refreshOptions,
  refreshShellIndex,
  runAfterRefresh,
}: {
  cwd: string;
  mode: ProjectImportRefreshMode;
  projectIds: string[];
  refreshOptions?: ProjectImportRefreshOptions;
  refreshShellIndex: (cwd: string, options?: ProjectImportRefreshOptions) => Promise<boolean>;
  runAfterRefresh: (projectIds: string[]) => Promise<T>;
}) {
  const refreshed = await refreshShellIndex(cwd, refreshOptions);
  const refreshError = getProjectImportRefreshError({
    mode,
    projectIds,
    refreshed,
  });

  if (refreshError) {
    return {
      error: refreshError,
    } satisfies DesktopActionResultData;
  }

  return await runAfterRefresh(projectIds);
}
