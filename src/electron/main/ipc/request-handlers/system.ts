import { stat } from "node:fs/promises";
import { clipboard, dialog, shell } from "electron";
import { getAttachmentKind, isSafeExternalUrl } from "../../../../../shared/composer-attachments";
import {
  listComposerAttachmentEntries,
  normalizeDialogFilePaths,
} from "../../../../desktop-host/composer-attachments";
import { readNativeClipboardFilePaths } from "./clipboard-file-paths";
import { getDesktopWorkingDirectory } from "../../../../../shared/desktop-working-directory";
import type { DesktopRequestHandlerMap } from "../../../../../shared/desktop-ipc";

type SystemRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | "pickComposerAttachments"
  | "readClipboardSnapshot"
  | "readClipboardFilePaths"
  | "getAttachmentKindsForPaths"
  | "listComposerAttachmentEntries"
  | "openExternal"
  | "openPath"
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
    readClipboardSnapshot: ({ formats: requestedFormats }) => {
      const formats = Array.isArray(requestedFormats)
        ? requestedFormats.filter((format) => typeof format === "string" && format.length > 0)
        : clipboard.availableFormats();
      const valuesByFormat = Object.fromEntries(
        formats.map((format) => {
          try {
            return [format, clipboard.read(format)] as const;
          } catch {
            return [format, ""] as const;
          }
        }),
      );

      if (!valuesByFormat["text/plain"]) {
        valuesByFormat["text/plain"] = clipboard.readText();
      }

      return { formats, valuesByFormat };
    },
    readClipboardFilePaths: () => readNativeClipboardFilePaths(),
    getAttachmentKindsForPaths: async ({ paths }) => {
      const uniquePaths = [...new Set(Array.isArray(paths) ? paths : [])].filter(
        (path): path is string => typeof path === "string" && path.trim().length > 0,
      );

      const entries = await Promise.all(
        uniquePaths.map(async (path) => {
          try {
            const stats = await stat(path);
            return [path, stats.isDirectory() ? "directory" : getAttachmentKind(path)] as const;
          } catch {
            return [path, null] as const;
          }
        }),
      );

      return Object.fromEntries(entries);
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
