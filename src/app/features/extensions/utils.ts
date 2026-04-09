import type { PiConfiguredPackage } from "../../desktop/types";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function getActionError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function formatDownloads(downloads: number) {
  return `${compactNumberFormatter.format(downloads)}/mo`;
}

function normalizeExternalUrl(url: string) {
  return url.replace(/^git\+/, "");
}

export function isDesktopPackagesAvailable() {
  return typeof window !== "undefined" && Boolean(window.piDesktop?.searchPiPackages);
}

export async function openExternalUrl(url: string) {
  const normalizedUrl = normalizeExternalUrl(url);

  if (window.piDesktop?.openExternal) {
    await window.piDesktop.openExternal(normalizedUrl);
    return;
  }

  window.open(normalizedUrl, "_blank", "noopener,noreferrer");
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
