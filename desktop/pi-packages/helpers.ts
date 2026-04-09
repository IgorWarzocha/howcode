import path from "node:path";
import type {
  PiConfiguredPackageType,
  PiPackageCatalogItem,
} from "../../shared/desktop-contracts.ts";

const localSourcePattern =
  /^(?:\.{1,2}(?:[\\/]|$)|[\\/]|~(?:[\\/]|$)|[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/;
const protocolGitSourcePattern = /^(?:git:|https?:\/\/|ssh:\/\/|git:\/\/)/i;
const sshGitSourcePattern = /^git@[^:]+:.+/i;

export function parseNpmPackageName(spec: string) {
  const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
  return match?.[1] ?? spec;
}

export function normalizePiPackageSource(source: string, kind: "npm" | "git") {
  const trimmedSource = source.trim();

  if (trimmedSource.length === 0) {
    return null;
  }

  if (kind === "npm") {
    return trimmedSource.startsWith("npm:") ? trimmedSource : `npm:${trimmedSource}`;
  }

  if (
    trimmedSource.startsWith("git:") ||
    protocolGitSourcePattern.test(trimmedSource) ||
    sshGitSourcePattern.test(trimmedSource)
  ) {
    return trimmedSource;
  }

  return `git:${trimmedSource}`;
}

export function getConfiguredPiPackageType(source: string): PiConfiguredPackageType {
  const trimmedSource = source.trim();

  if (trimmedSource.startsWith("npm:")) {
    return "npm";
  }

  if (localSourcePattern.test(trimmedSource)) {
    return "local";
  }

  return "git";
}

function stripGitRef(source: string) {
  const lastAtIndex = source.lastIndexOf("@");

  if (lastAtIndex <= 0) {
    return source;
  }

  if (sshGitSourcePattern.test(source)) {
    const pathSeparatorIndex = source.indexOf(":");
    return lastAtIndex > pathSeparatorIndex ? source.slice(0, lastAtIndex) : source;
  }

  const lastSlashIndex = Math.max(source.lastIndexOf("/"), source.lastIndexOf(":"));
  return lastAtIndex > lastSlashIndex ? source.slice(0, lastAtIndex) : source;
}

export function getPiPackageIdentityKey(source: string) {
  const trimmedSource = source.trim();
  const packageType = getConfiguredPiPackageType(trimmedSource);

  if (packageType === "npm") {
    return `npm:${parseNpmPackageName(trimmedSource.slice(4))}`;
  }

  if (packageType === "local") {
    return `local:${trimmedSource}`;
  }

  const withoutPrefix = trimmedSource.startsWith("git:") ? trimmedSource.slice(4) : trimmedSource;
  const withoutRef = stripGitRef(withoutPrefix).replace(/\.git$/i, "");

  return `git:${withoutRef.toLowerCase()}`;
}

export function getConfiguredPiPackageDisplayName(source: string) {
  const packageType = getConfiguredPiPackageType(source);

  if (packageType === "npm") {
    return source.slice(4);
  }

  if (packageType === "git") {
    return source.startsWith("git:") ? source.slice(4) : source;
  }

  return path.basename(source) || source;
}

export function sortPiPackageCatalogItems(items: PiPackageCatalogItem[]) {
  return [...items].sort((left, right) => {
    if (right.monthlyDownloads !== left.monthlyDownloads) {
      return right.monthlyDownloads - left.monthlyDownloads;
    }

    if (right.weeklyDownloads !== left.weeklyDownloads) {
      return right.weeklyDownloads - left.weeklyDownloads;
    }

    if (right.searchScore !== left.searchScore) {
      return right.searchScore - left.searchScore;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}
