import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const DEV_SERVER_HOST = "127.0.0.1";
export const DEV_SERVER_START_PORT = 5173;
export const DEV_SERVER_METADATA_RELATIVE_PATH = path.join("build", "dev-server.json");

const REPO_ROOT_MARKERS = ["package.json", "electrobun.config.ts"] as const;

function hasRepoRootMarkers(candidatePath: string) {
  return REPO_ROOT_MARKERS.every((entry) => existsSync(path.join(candidatePath, entry)));
}

function normalizeSearchStartPath(candidatePath: string) {
  const trimmedPath = candidatePath.trim();
  if (trimmedPath.length === 0) {
    return null;
  }

  const resolvedPath = path.resolve(trimmedPath);
  if (!existsSync(resolvedPath)) {
    return path.dirname(resolvedPath);
  }

  return statSync(resolvedPath).isDirectory() ? resolvedPath : path.dirname(resolvedPath);
}

export function resolveRepoRoot(searchStartPaths: readonly string[]) {
  for (const candidatePath of searchStartPaths) {
    const normalizedStartPath = normalizeSearchStartPath(candidatePath);
    if (!normalizedStartPath) {
      continue;
    }

    let currentPath = normalizedStartPath;

    while (true) {
      if (hasRepoRootMarkers(currentPath)) {
        return currentPath;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }

      currentPath = parentPath;
    }
  }

  return null;
}

export function resolveDevServerMetadataPath(searchStartPaths: readonly string[]) {
  const repoRootPath = resolveRepoRoot(searchStartPaths);
  return repoRootPath ? path.join(repoRootPath, DEV_SERVER_METADATA_RELATIVE_PATH) : null;
}

export function parseDevServerMetadata(rawMetadata: string) {
  const parsedMetadata = JSON.parse(rawMetadata) as {
    host?: unknown;
    port?: unknown;
    url?: unknown;
  };

  if (typeof parsedMetadata.url === "string" && parsedMetadata.url.length > 0) {
    return parsedMetadata.url;
  }

  if (typeof parsedMetadata.host === "string" && typeof parsedMetadata.port === "number") {
    return `http://${parsedMetadata.host}:${parsedMetadata.port}`;
  }

  return null;
}
