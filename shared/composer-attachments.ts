import type { ComposerAttachment } from "./desktop-data-contracts";

const imageAttachmentPattern = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const unixAbsolutePathRoots = new Set([
  "Applications",
  "Library",
  "System",
  "Users",
  "Volumes",
  "bin",
  "dev",
  "etc",
  "home",
  "media",
  "mnt",
  "opt",
  "private",
  "proc",
  "repo",
  "root",
  "run",
  "sbin",
  "srv",
  "tmp",
  "usr",
  "var",
  "workspace",
  "workspaces",
]);

function stripWrappingCharacters(value: string) {
  const trimmed = value.trim();

  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];

    if (
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "<" && last === ">")
    ) {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
}

function decodeFileUrlPath(url: URL) {
  const decodedPath = decodeURIComponent(url.pathname);

  if (/^\/[A-Za-z]:\//.test(decodedPath)) {
    return decodedPath.slice(1);
  }

  if (url.hostname) {
    return `//${url.hostname}${decodedPath}`;
  }

  return decodedPath;
}

function isLikelyLocalFilePath(candidate: string) {
  const pathSegments = candidate.split(/[\\/]/).filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] ?? "";

  return (
    (candidate.startsWith("/") &&
      candidate !== "/" &&
      pathSegments.length >= 1 &&
      unixAbsolutePathRoots.has(pathSegments[0] ?? "")) ||
    /^[A-Za-z]:[\\/]/.test(candidate) ||
    candidate.startsWith("\\\\")
  );
}

function getUrlAttachmentName(url: URL) {
  const pathnameParts = url.pathname.split("/").filter(Boolean);
  return pathnameParts[pathnameParts.length - 1] || url.hostname;
}

function getPathAttachmentName(filePath: string) {
  const normalizedPath = filePath.replace(/[\\/]+$/, "");
  const parts = normalizedPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || normalizedPath || filePath;
}

function toAttachment(path: string, name: string): ComposerAttachment {
  return {
    path,
    name,
    kind: getAttachmentKind(path),
  };
}

export function getAttachmentKind(filePath: string): ComposerAttachment["kind"] {
  return imageAttachmentPattern.test(filePath) ? "image" : "text";
}

export function isSafeExternalUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function mergeComposerAttachments(
  current: ComposerAttachment[],
  next: ComposerAttachment[],
) {
  const byPath = new Map(current.map((attachment) => [attachment.path, attachment]));

  for (const attachment of next) {
    byPath.set(attachment.path, attachment);
  }

  return [...byPath.values()];
}

export function normalizeComposerAttachments(
  attachments: ComposerAttachment[],
  options?: {
    resolveAttachmentKind?: (path: string) => ComposerAttachment["kind"] | null;
  },
) {
  return mergeComposerAttachments(
    [],
    attachments
      .map((attachment) => {
        const path = attachment.path.trim();
        if (!path) {
          return null;
        }

        let resolvedKind: ComposerAttachment["kind"];

        if (isSafeExternalUrl(path)) {
          resolvedKind = "text";
        } else if (options?.resolveAttachmentKind) {
          const nextKind = options.resolveAttachmentKind(path);
          if (nextKind === null) {
            return null;
          }

          resolvedKind = nextKind;
        } else {
          resolvedKind = attachment.kind;
        }

        const name = attachment.name.trim() || getPathAttachmentName(path);

        return {
          path,
          name,
          kind: resolvedKind,
        } satisfies ComposerAttachment;
      })
      .filter((attachment): attachment is ComposerAttachment => attachment !== null),
  );
}

export function parseComposerAttachmentReference(rawReference: string): ComposerAttachment | null {
  const candidate = stripWrappingCharacters(rawReference);
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("file://")) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "file:") {
        return null;
      }

      const filePath = decodeFileUrlPath(url);
      return filePath ? toAttachment(filePath, getPathAttachmentName(filePath)) : null;
    } catch {
      return null;
    }
  }

  if (isSafeExternalUrl(candidate)) {
    const url = new URL(candidate);
    return toAttachment(candidate, getUrlAttachmentName(url));
  }

  if (isLikelyLocalFilePath(candidate)) {
    return toAttachment(candidate, getPathAttachmentName(candidate));
  }

  return null;
}

export function extractComposerAttachmentsFromPaste(
  pastedText: string,
  options?: { sourceType?: string | null },
): ComposerAttachment[] {
  const trimmed = pastedText.trim();
  if (!trimmed) {
    return [];
  }

  const isMultiline = /\r|\n/.test(trimmed);
  const shouldIgnoreCommentLines = options?.sourceType === "text/uri-list";
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && (!shouldIgnoreCommentLines || !line.startsWith("#")));
  const candidates = isMultiline ? lines : [trimmed];
  const attachments = candidates
    .map((candidate) => parseComposerAttachmentReference(candidate))
    .filter((attachment): attachment is ComposerAttachment => attachment !== null);

  return attachments.length === candidates.length ? mergeComposerAttachments([], attachments) : [];
}
