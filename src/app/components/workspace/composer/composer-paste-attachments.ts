import type {
  ComposerAttachment,
  DesktopClipboardFilePaths,
  DesktopClipboardSnapshot,
} from "../../../desktop/types";
import {
  extractComposerAttachmentsFromPaste,
  getAttachmentKind,
  mergeComposerAttachments,
} from "../../../../../shared/composer-attachments";

type ClipboardFileLike = {
  path?: string | null;
  name?: string | null;
  type?: string | null;
};

type ClipboardItemLike = {
  kind?: string | null;
  type?: string | null;
  getAsFile?: () => ClipboardFileLike | null;
};

export type ComposerClipboardDataLike = {
  getData: (type: string) => string;
  types?: Iterable<string> | ArrayLike<string> | null;
  files?: Iterable<ClipboardFileLike> | ArrayLike<ClipboardFileLike> | null;
  items?: Iterable<ClipboardItemLike> | ArrayLike<ClipboardItemLike> | null;
};

type ComposerClipboardTextSourceLike = Pick<ComposerClipboardDataLike, "getData" | "types">;
type ClipboardFilePathResolver = (file: ClipboardFileLike) => string | null;

const preferredClipboardTypes = [
  "text/uri-list",
  "x-special/gnome-copied-files",
  "public.file-url",
  "public.url",
  "text/plain",
  "text",
];

const attachmentHintClipboardTypes = new Set([
  "text/uri-list",
  "x-special/gnome-copied-files",
  "public.file-url",
  "public.url",
]);

const fileTransferTypes = new Set(["Files", "application/x-moz-file"]);

export const attachmentClipboardSnapshotFormats = [...preferredClipboardTypes];

function toArray<T>(value: Iterable<T> | ArrayLike<T> | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.from(value);
}

function normalizeClipboardRawText(value: string) {
  return value.replaceAll("\0", "\n");
}

function normalizeClipboardPayloadByType(type: string, value: string) {
  const rawValue = normalizeClipboardRawText(value);
  const normalized = rawValue.trim();
  if (!normalized) {
    return "";
  }

  if (type === "x-special/gnome-copied-files") {
    const lines = normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines[0] === "copy" || lines[0] === "cut") {
      return lines.slice(1).join("\n");
    }
  }

  return normalized;
}

function getTextSourceTypes(source: ComposerClipboardTextSourceLike) {
  const typeSet = new Set<string>(preferredClipboardTypes);

  for (const type of toArray(source.types)) {
    if (typeof type === "string" && type.length > 0) {
      typeSet.add(type);
    }
  }

  return [...typeSet];
}

function getClipboardTextValues(source: ComposerClipboardTextSourceLike) {
  return getTextSourceTypes(source)
    .map((type) => ({ type, value: normalizeClipboardPayloadByType(type, source.getData(type)) }))
    .filter(({ value }) => value.length > 0);
}

function getClipboardRawTextValues(source: ComposerClipboardTextSourceLike) {
  return getTextSourceTypes(source)
    .map((type) => ({ type, value: normalizeClipboardRawText(source.getData(type)) }))
    .filter(({ value }) => value.length > 0);
}

function getClipboardTextValueByType(source: ComposerClipboardTextSourceLike, type: string) {
  return normalizeClipboardPayloadByType(type, source.getData(type));
}

function getClipboardRawTextValueByType(source: ComposerClipboardTextSourceLike, type: string) {
  return normalizeClipboardRawText(source.getData(type));
}

function shouldTreatClipboardValueAsAttachment(
  source: ComposerClipboardTextSourceLike,
  type: string,
  value: string,
) {
  if (type !== "public.url") {
    return true;
  }

  const plainTextValue =
    getClipboardTextValueByType(source, "text/plain") ||
    getClipboardTextValueByType(source, "text");

  return plainTextValue.length === 0 || plainTextValue === value;
}

function getClipboardFilePath(
  file: ClipboardFileLike | null | undefined,
  resolveFilePath?: ClipboardFilePathResolver,
) {
  if (typeof file?.path === "string" && file.path.trim().length > 0) {
    return file.path.trim();
  }

  return resolveFilePath?.(file ?? {}) ?? null;
}

function getClipboardFileName(file: ClipboardFileLike, filePath: string) {
  if (typeof file.name === "string" && file.name.trim().length > 0) {
    return file.name.trim();
  }

  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function buildAttachmentFromPath(filePath: string): ComposerAttachment {
  return {
    path: filePath,
    name: getClipboardFileName({ path: filePath }, filePath),
    kind: getAttachmentKind(filePath),
  };
}

function getClipboardFileAttachment(
  file: ClipboardFileLike,
  resolveFilePath?: ClipboardFilePathResolver,
): ComposerAttachment | null {
  const filePath = getClipboardFilePath(file, resolveFilePath);
  if (!filePath) {
    return null;
  }

  return {
    path: filePath,
    name: getClipboardFileName(file, filePath),
    kind:
      typeof file.type === "string" && file.type.startsWith("image/")
        ? "image"
        : getAttachmentKind(filePath),
  };
}

function getClipboardFileAttachments(
  clipboardData: ComposerClipboardDataLike,
  resolveFilePath?: ClipboardFilePathResolver,
) {
  const directFiles = toArray(clipboardData.files).map((file) =>
    getClipboardFileAttachment(file, resolveFilePath),
  );
  const itemFiles = toArray(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile?.() ?? null)
    .map((file) => (file ? getClipboardFileAttachment(file, resolveFilePath) : null));

  return mergeComposerAttachments(
    [],
    [...directFiles, ...itemFiles].filter(
      (attachment): attachment is ComposerAttachment => attachment !== null,
    ),
  );
}

function getClipboardTextAttachments(clipboardData: ComposerClipboardDataLike) {
  let attachments: ComposerAttachment[] = [];

  for (const { type, value: normalizedValue } of getClipboardTextValues(clipboardData)) {
    if (!shouldTreatClipboardValueAsAttachment(clipboardData, type, normalizedValue)) {
      continue;
    }

    attachments = mergeComposerAttachments(
      attachments,
      extractComposerAttachmentsFromPaste(normalizedValue, { sourceType: type }),
    );
  }

  return attachments;
}

export function getComposerAttachmentsFromClipboardData(
  clipboardData: ComposerClipboardDataLike | null,
  options?: { resolveFilePath?: ClipboardFilePathResolver },
) {
  if (!clipboardData) {
    return [];
  }

  return mergeComposerAttachments(
    getClipboardFileAttachments(clipboardData, options?.resolveFilePath),
    getClipboardTextAttachments(clipboardData),
  );
}

export function hasFilePayloadInClipboardData(clipboardData: ComposerClipboardDataLike | null) {
  if (!clipboardData) {
    return false;
  }

  if (toArray(clipboardData.files).length > 0) {
    return true;
  }

  for (const item of toArray(clipboardData.items)) {
    if (item.kind === "file") {
      return true;
    }
  }

  for (const type of toArray(clipboardData.types)) {
    if (typeof type === "string" && fileTransferTypes.has(type)) {
      return true;
    }
  }

  return false;
}

export function hasAttachmentHintInClipboardData(clipboardData: ComposerClipboardDataLike | null) {
  if (!clipboardData) {
    return false;
  }

  if (hasFilePayloadInClipboardData(clipboardData)) {
    return true;
  }

  if (getClipboardFileAttachments(clipboardData).length > 0) {
    return true;
  }

  for (const item of toArray(clipboardData.items)) {
    if (item.kind === "file") {
      return true;
    }
  }

  for (const type of toArray(clipboardData.types)) {
    if (typeof type === "string" && attachmentHintClipboardTypes.has(type)) {
      return true;
    }
  }

  return false;
}

export function getComposerAttachmentsFromClipboardFilePaths(
  clipboardFilePaths: DesktopClipboardFilePaths | null,
) {
  if (!clipboardFilePaths) {
    return [];
  }

  const pathAttachments = mergeComposerAttachments(
    [],
    (Array.isArray(clipboardFilePaths.filePaths) ? clipboardFilePaths.filePaths : [])
      .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0)
      .map(buildAttachmentFromPath),
  );

  if (pathAttachments.length > 0) {
    return pathAttachments;
  }

  return extractComposerAttachmentsFromPaste(clipboardFilePaths.text ?? "");
}

function createClipboardSnapshotSource(
  snapshot: DesktopClipboardSnapshot | null,
): ComposerClipboardTextSourceLike | null {
  if (!snapshot) {
    return null;
  }

  return {
    getData: (type: string) => snapshot.valuesByFormat[type] ?? "",
    types: snapshot.formats,
  };
}

export function getComposerAttachmentsFromClipboardSnapshot(
  snapshot: DesktopClipboardSnapshot | null,
) {
  const source = createClipboardSnapshotSource(snapshot);
  if (!source) {
    return [];
  }

  return getClipboardTextAttachments(source);
}

export function getPreferredClipboardText(source: ComposerClipboardTextSourceLike | null) {
  if (!source) {
    return "";
  }

  const preferredPlainTextValue =
    getClipboardRawTextValueByType(source, "text/plain") ||
    getClipboardRawTextValueByType(source, "text");

  if (preferredPlainTextValue.length > 0) {
    return preferredPlainTextValue;
  }

  return getClipboardRawTextValues(source)[0]?.value ?? "";
}

export function getPreferredClipboardTextFromClipboardData(
  clipboardData: ComposerClipboardDataLike | null,
) {
  return getPreferredClipboardText(clipboardData);
}

export function getPreferredClipboardTextFromClipboardSnapshot(
  snapshot: DesktopClipboardSnapshot | null,
) {
  return getPreferredClipboardText(createClipboardSnapshotSource(snapshot));
}

export function getPreferredClipboardTextFromClipboardFilePaths(
  clipboardFilePaths: DesktopClipboardFilePaths | null,
) {
  return clipboardFilePaths?.text ?? "";
}
