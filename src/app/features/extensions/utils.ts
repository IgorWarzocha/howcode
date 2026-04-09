import type { PiConfiguredPackage } from "../../desktop/types";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const allowedExternalProtocols = new Set(["http:", "https:"]);

export function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function formatDownloads(downloads: number) {
  return `${compactNumberFormatter.format(downloads)}/mo`;
}

function normalizeExternalUrl(url: string) {
  return url.replace(/^git\+/, "");
}

export function getSafeExternalUrl(url: string | null | undefined) {
  if (typeof url !== "string") {
    return null;
  }

  const normalizedUrl = normalizeExternalUrl(url.trim());
  if (normalizedUrl.length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return allowedExternalProtocols.has(parsedUrl.protocol) ? parsedUrl.toString() : null;
  } catch {
    return null;
  }
}

export function pickSafeExternalUrl(urls: Array<string | null | undefined>) {
  for (const url of urls) {
    const safeUrl = getSafeExternalUrl(url);
    if (safeUrl) {
      return safeUrl;
    }
  }

  return null;
}

export function isDesktopPackagesAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiPackages);
}

export async function openExternalUrl(url: string) {
  const safeUrl = getSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  if (window.piDesktop?.openExternal) {
    await window.piDesktop.openExternal(safeUrl);
    return true;
  }

  window.open(safeUrl, "_blank", "noopener,noreferrer");
  return true;
}

export function getInstalledIdentityKeys(packages: PiConfiguredPackage[]) {
  return new Set(
    packages
      .filter(
        (configuredPackage) =>
          configuredPackage.resourceKind === "package" &&
          typeof configuredPackage.installedPath === "string",
      )
      .map((configuredPackage) => configuredPackage.identityKey),
  );
}

export function getConfiguredSourceLabel(configuredPackage: PiConfiguredPackage) {
  if (configuredPackage.type === "local") {
    return configuredPackage.source;
  }

  return configuredPackage.type;
}

export function isConfiguredSourcePath(configuredPackage: PiConfiguredPackage) {
  return configuredPackage.type === "local";
}
