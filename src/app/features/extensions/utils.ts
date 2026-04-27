import type { PiConfiguredPackage } from "../../desktop/types";
import { getSafeExternalUrl, pickSafeExternalUrl } from "../../../../shared/external-url";
import { getActionError } from "../../utils/action-error";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export { getActionError, getSafeExternalUrl, pickSafeExternalUrl };

export function formatDownloads(downloads: number) {
  return `${compactNumberFormatter.format(downloads)}/mo`;
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
