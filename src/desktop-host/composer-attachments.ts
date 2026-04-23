import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ComposerFilePickerEntry,
  ComposerFilePickerState,
} from "../../shared/desktop-contracts";
import { getAttachmentKind } from "../../shared/composer-attachments";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory";

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function normalizeDialogFilePaths(filePaths: string[]) {
  const normalized: string[] = [];

  for (let index = 0; index < filePaths.length; index += 1) {
    let candidate = filePaths[index]?.trim();
    if (!candidate) {
      continue;
    }

    while (!(await pathExists(candidate)) && index + 1 < filePaths.length) {
      index += 1;
      candidate = `${candidate},${filePaths[index] ?? ""}`;
    }

    normalized.push(candidate);
  }

  return normalized;
}

function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath.length === 0 || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

export async function listComposerAttachmentEntries(request: {
  projectId?: string | null;
  path?: string | null;
  rootPath?: string | null;
}): Promise<ComposerFilePickerState> {
  const homePath = os.homedir();
  const rootPath = path.resolve(
    request.rootPath ?? request.projectId ?? getDesktopWorkingDirectory(),
  );
  const requestedPath = path.resolve(request.path ?? rootPath);
  const currentPath = isPathWithinRoot(requestedPath, rootPath) ? requestedPath : rootPath;
  const directoryEntries = await readdir(currentPath, { withFileTypes: true });

  const entries: ComposerFilePickerEntry[] = directoryEntries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        return {
          path: entryPath,
          name: entry.name,
          kind: "directory",
        } satisfies ComposerFilePickerEntry;
      }

      return {
        path: entryPath,
        name: entry.name,
        kind: getAttachmentKind(entryPath),
      } satisfies ComposerFilePickerEntry;
    })
    .sort((left, right) => {
      if (left.kind === "directory" && right.kind !== "directory") {
        return -1;
      }

      if (left.kind !== "directory" && right.kind === "directory") {
        return 1;
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });

  return {
    homePath,
    rootPath,
    currentPath,
    parentPath: currentPath === rootPath ? null : path.dirname(currentPath),
    entries,
  };
}
