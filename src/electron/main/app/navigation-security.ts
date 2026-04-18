import path from "node:path";
import { fileURLToPath } from "node:url";

export type RendererTrustConfig = {
  rendererDistDirectory: string;
  devServerUrl?: string | null;
};

const EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function tryParseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function getDevServerOrigin(devServerUrl?: string | null) {
  if (!devServerUrl) {
    return null;
  }

  const parsedUrl = tryParseUrl(devServerUrl);
  return parsedUrl ? parsedUrl.origin : null;
}

export function isTrustedRendererUrl(rawUrl: string, config: RendererTrustConfig) {
  const parsedUrl = tryParseUrl(rawUrl);
  if (!parsedUrl) {
    return false;
  }

  if (parsedUrl.protocol === "file:") {
    const trustedIndexPath = path.resolve(path.join(config.rendererDistDirectory, "index.html"));

    try {
      return path.resolve(fileURLToPath(parsedUrl)) === trustedIndexPath;
    } catch {
      return false;
    }
  }

  const trustedDevServerOrigin = getDevServerOrigin(config.devServerUrl);
  return trustedDevServerOrigin ? parsedUrl.origin === trustedDevServerOrigin : false;
}

export function shouldOpenUrlExternally(rawUrl: string) {
  const parsedUrl = tryParseUrl(rawUrl);
  return parsedUrl ? EXTERNAL_URL_PROTOCOLS.has(parsedUrl.protocol) : false;
}
