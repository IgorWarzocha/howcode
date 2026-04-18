import { dialog, shell } from "electron";
import {
  getAttachmentKind,
  isSafeExternalUrl,
  listComposerAttachmentEntries,
  normalizeDialogFilePaths,
} from "../../../../desktop-host/composer-attachments";
import { getDesktopWorkingDirectory } from "../../../../../shared/desktop-working-directory";
import type { DesktopRequestHandlerMap } from "../../../../../shared/desktop-ipc";

type SystemRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  "pickComposerAttachments" | "listComposerAttachmentEntries" | "openExternal" | "openPath"
>;

export function createSystemHandlers(): SystemRequestHandlers {
  return {
    pickComposerAttachments: async ({ projectId }) => {
      const result = await dialog.showOpenDialog({
        defaultPath: projectId ?? getDesktopWorkingDirectory(),
        properties: ["openFile", "multiSelections"],
      });

      if (result.canceled) {
        return [];
      }

      const normalizedFilePaths = await normalizeDialogFilePaths(result.filePaths);

      return normalizedFilePaths
        .filter((filePath) => filePath.length > 0)
        .map((filePath) => ({
          path: filePath,
          name: filePath.split(/[\\/]/).pop() ?? filePath,
          kind: getAttachmentKind(filePath),
        }));
    },
    listComposerAttachmentEntries: (request) => listComposerAttachmentEntries(request),
    openExternal: async ({ url }) => {
      if (!isSafeExternalUrl(url)) {
        return { ok: false };
      }

      try {
        await shell.openExternal(url);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    openPath: async ({ path }) => {
      try {
        return { ok: (await shell.openPath(path)) === "" };
      } catch {
        return { ok: false };
      }
    },
  };
}
