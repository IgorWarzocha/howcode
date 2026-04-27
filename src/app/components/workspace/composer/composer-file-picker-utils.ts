import { normalizeComposerAttachments } from "../../../../../shared/composer-attachments";
import { isSafeExternalUrl } from "../../../../../shared/external-url";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import {
  getAttachmentKindsForPathsQuery,
  getPathForFileQuery,
  openExternalQuery,
  openPathQuery,
} from "../../../query/desktop-query";
import { buildLocalAttachmentKindLookup } from "./composer-attachment-kind-lookup";
import { getComposerAttachmentsFromClipboardData } from "./composer-paste-attachments";

export type ComposerFilePickerRootOption = {
  path: string;
  label: string;
  iconOnly: boolean;
};

export function getFolderLabel(folderPath: string) {
  const segments = folderPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? folderPath;
}

export function buildFilePickerRootOptions({
  favoriteFolders,
  picker,
  projectRootPath,
}: {
  favoriteFolders: string[];
  picker: ComposerFilePickerState | null;
  projectRootPath: string;
}) {
  return [
    ...(picker?.homePath ? [{ path: picker.homePath, label: "Home", iconOnly: true }] : []),
    { path: projectRootPath, label: "Project", iconOnly: false },
    ...favoriteFolders.map((folderPath) => ({
      path: folderPath,
      label: getFolderLabel(folderPath),
      iconOnly: false,
    })),
  ].filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.path === option.path) === index,
  );
}

export function filterFilePickerEntries(
  entries: ComposerFilePickerState["entries"],
  searchQuery: string,
) {
  const query = searchQuery.trim().toLowerCase();

  if (!query) {
    return entries;
  }

  return entries.filter((entry) => entry.name.toLowerCase().includes(query));
}

export function getOpenAttachmentLabel(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    return `Open ${attachment.name} in browser`;
  }

  return `Open ${attachment.name}`;
}

export function getAttachmentDisplayLabel(attachment: ComposerAttachment) {
  if (!isSafeExternalUrl(attachment.path)) {
    if (attachment.kind === "directory") {
      const normalizedPath = attachment.path.replace(/[\\/]+$/, "");
      const parts = normalizedPath.split(/[\\/]/).filter(Boolean);

      if (parts.length >= 2) {
        return `${attachment.path.startsWith("/") ? "/" : ""}${parts.slice(-2).join("/")}`;
      }
    }

    return attachment.name;
  }

  return attachment.path.replace(/^https?:\/\//i, "");
}

export async function openComposerAttachment(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    if (openExternalQuery) {
      await openExternalQuery(attachment.path);
      return;
    }

    window.open(attachment.path, "_blank", "noopener,noreferrer");
    return;
  }

  await openPathQuery(attachment.path);
}

function resolveAttachmentKindFromLookup(
  path: string,
  kindsByPath: Record<string, ComposerAttachment["kind"] | null> | null,
  fallbackKindsByPath: Record<string, ComposerAttachment["kind"]>,
) {
  if (kindsByPath && Object.prototype.hasOwnProperty.call(kindsByPath, path)) {
    return kindsByPath[path] ?? null;
  }

  return fallbackKindsByPath[path] ?? null;
}

export async function getDroppedComposerAttachments(dataTransfer: DataTransfer) {
  const rawAttachments = getComposerAttachmentsFromClipboardData(dataTransfer, {
    resolveFilePath: (file) => getPathForFileQuery(file as File) ?? null,
  });
  const { fallbackKindsByPath, localPaths } = buildLocalAttachmentKindLookup(rawAttachments);
  let kindsByPath: Record<string, ComposerAttachment["kind"] | null> | null = null;

  try {
    kindsByPath = (await getAttachmentKindsForPathsQuery(localPaths)) ?? null;
  } catch {
    kindsByPath = null;
  }

  return normalizeComposerAttachments(rawAttachments, {
    resolveAttachmentKind: (path) =>
      resolveAttachmentKindFromLookup(path, kindsByPath, fallbackKindsByPath),
  });
}
