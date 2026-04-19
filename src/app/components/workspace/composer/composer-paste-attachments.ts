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

const preferredClipboardTypes = [
  "text/uri-list",
  "x-special/gnome-copied-files",
  "public.file-url",
  "public.url",
  "text/plain",
  "text",
];

function toArray<T>(value: Iterable<T> | ArrayLike<T> | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.from(value);
}

function normalizeClipboardText(value: string) {
  return value.replaceAll("\0", "\n").trim();
}

function normalizeClipboardPayloadByType(type: string, value: string) {
  const normalized = normalizeClipboardText(value);
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

function getClipboardFilePath(file: ClipboardFileLike | null | undefined) {
  return typeof file?.path === "string" && file.path.trim().length > 0 ? file.path.trim() : null;
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

function getClipboardFileAttachment(file: ClipboardFileLike): ComposerAttachment | null {
  const filePath = getClipboardFilePath(file);
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

function getClipboardFileAttachments(clipboardData: ComposerClipboardDataLike) {
  const directFiles = toArray(clipboardData.files).map(getClipboardFileAttachment);
  const itemFiles = toArray(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile?.() ?? null)
    .map((file) => (file ? getClipboardFileAttachment(file) : null));

  return mergeComposerAttachments(
    [],
    [...directFiles, ...itemFiles].filter(
      (attachment): attachment is ComposerAttachment => attachment !== null,
    ),
  );
}

function getClipboardTextAttachments(clipboardData: ComposerClipboardDataLike) {
  let attachments: ComposerAttachment[] = [];

  for (const { value: normalizedValue } of getClipboardTextValues(clipboardData)) {
    attachments = mergeComposerAttachments(
      attachments,
      extractComposerAttachmentsFromPaste(normalizedValue),
    );
  }

  return attachments;
}

export function getComposerAttachmentsFromClipboardData(
  clipboardData: ComposerClipboardDataLike | null,
) {
  if (!clipboardData) {
    return [];
  }

  return mergeComposerAttachments(
    getClipboardFileAttachments(clipboardData),
    getClipboardTextAttachments(clipboardData),
  );
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

  return getClipboardTextValues(source)[0]?.value ?? "";
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
