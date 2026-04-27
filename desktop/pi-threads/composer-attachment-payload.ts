import path from "node:path";
import { stat } from "node:fs/promises";
import type { ComposerAttachment } from "../../shared/desktop-contracts";
import { getSafeExternalUrl, isSafeExternalUrl } from "../../shared/external-url";
import { getAttachmentKind, normalizeComposerAttachments } from "../../shared/composer-attachments";

const maxConcurrentAttachmentStats = 8;
function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}

type StatLike = Pick<Awaited<ReturnType<typeof stat>>, "isDirectory">;

type AttachmentStat = (path: string) => Promise<StatLike>;

type AttachmentPlatform = NodeJS.Platform;

type PreparedLocalAttachmentPath = {
  normalizedPath: string;
  statPath: string;
};

function getLocalAttachmentPathParts(
  attachmentPath: string,
  platform: AttachmentPlatform,
): PreparedLocalAttachmentPath | null {
  const trimmedPath = attachmentPath.trim();
  if (!trimmedPath || isSafeExternalUrl(trimmedPath) || hasControlCharacters(trimmedPath)) {
    return null;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmedPath)) {
    const normalizedPath = path.win32.normalize(trimmedPath);
    return normalizedPath === path.win32.parse(normalizedPath).root
      ? null
      : { normalizedPath, statPath: trimmedPath };
  }

  if (trimmedPath.startsWith("\\\\") || (platform === "win32" && trimmedPath.startsWith("//"))) {
    const normalizedPath = path.win32.normalize(trimmedPath);
    return normalizedPath === path.win32.parse(normalizedPath).root
      ? null
      : { normalizedPath, statPath: trimmedPath };
  }

  if (trimmedPath.startsWith("/")) {
    const normalizedPath = path.posix.normalize(trimmedPath);
    return normalizedPath === "/" ? null : { normalizedPath, statPath: trimmedPath };
  }

  return null;
}

async function resolveLocalAttachmentKind(
  attachmentPath: string,
  statAttachmentPath: AttachmentStat,
): Promise<ComposerAttachment["kind"] | null> {
  try {
    const stats = await statAttachmentPath(attachmentPath);
    return stats.isDirectory() ? "directory" : getAttachmentKind(attachmentPath);
  } catch {
    return null;
  }
}

async function statLocalAttachmentPaths(
  localPaths: PreparedLocalAttachmentPath[],
  statAttachmentPath: AttachmentStat,
) {
  const localAttachmentKinds = new Map<string, ComposerAttachment["kind"] | null>();
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < localPaths.length) {
      const attachmentPath = localPaths[nextIndex];
      nextIndex += 1;

      if (!attachmentPath) {
        continue;
      }

      localAttachmentKinds.set(
        attachmentPath.normalizedPath,
        await resolveLocalAttachmentKind(attachmentPath.statPath, statAttachmentPath),
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrentAttachmentStats, localPaths.length) }, () =>
      worker(),
    ),
  );

  return localAttachmentKinds;
}

export async function normalizeComposerSendAttachments(
  attachments: ComposerAttachment[],
  options?: { statAttachmentPath?: AttachmentStat; platform?: AttachmentPlatform },
): Promise<{ attachments: ComposerAttachment[]; rejected: boolean }> {
  const statAttachmentPath = options?.statAttachmentPath ?? stat;
  const platform = options?.platform ?? process.platform;
  const localPathsByNormalizedPath = new Map<string, PreparedLocalAttachmentPath>();

  for (const attachment of attachments) {
    const pathParts = getLocalAttachmentPathParts(attachment.path, platform);
    if (pathParts) {
      localPathsByNormalizedPath.set(pathParts.normalizedPath, pathParts);
    }
  }

  const localAttachmentKinds = await statLocalAttachmentPaths(
    [...localPathsByNormalizedPath.values()],
    statAttachmentPath,
  );
  let rejected = false;

  const normalizedAttachments = normalizeComposerAttachments(
    attachments.map((attachment) => {
      const trimmedPath = attachment.path.trim();
      const safeExternalUrl = getSafeExternalUrl(trimmedPath);
      if (safeExternalUrl) {
        return { ...attachment, path: safeExternalUrl };
      }

      const pathParts = getLocalAttachmentPathParts(attachment.path, platform);
      return pathParts ? { ...attachment, path: pathParts.normalizedPath } : attachment;
    }),
    {
      resolveAttachmentKind: (attachmentPath) => {
        const pathParts = getLocalAttachmentPathParts(attachmentPath, platform);
        if (!pathParts) {
          rejected = true;
          return null;
        }

        const kind = localAttachmentKinds.get(pathParts.normalizedPath) ?? null;
        if (kind === null) {
          rejected = true;
        }

        return kind;
      },
    },
  );

  return { attachments: normalizedAttachments, rejected };
}
