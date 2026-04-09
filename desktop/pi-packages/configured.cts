import path from "node:path";
import type { PiConfiguredPackage } from "../../shared/desktop-contracts.ts";
import {
  getConfiguredPiPackageDisplayName,
  getConfiguredPiPackageType,
  getPiPackageIdentityKey,
} from "./helpers.ts";
import { getPiPackageServices, resolveConfiguredExtensionPath } from "./services.cts";
import type { PiConfiguredPackageRecord, PiSettingsPackageSource } from "./types.ts";

function sortConfiguredPackages(packages: PiConfiguredPackage[]) {
  return [...packages].sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope === "user" ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
}

export async function listConfiguredPiPackages(
  request: {
    projectPath?: string | null;
  } = {},
): Promise<PiConfiguredPackage[]> {
  const { packageManager, settingsManager, agentDir } = await getPiPackageServices(
    request.projectPath,
  );
  const configuredPackages: PiConfiguredPackageRecord[] = [];
  const projectPath = request.projectPath?.trim() ? path.resolve(request.projectPath) : null;
  const globalSettingsPath = path.join(agentDir, "settings.json");
  const projectSettingsPath = projectPath ? path.join(projectPath, ".pi", "settings.json") : null;

  const appendPackages = (scope: "user" | "project", packageSources: PiSettingsPackageSource[]) => {
    for (const packageSource of packageSources) {
      const source = typeof packageSource === "string" ? packageSource : packageSource.source;
      const settingsPath = scope === "user" ? globalSettingsPath : projectSettingsPath;

      if (!settingsPath) {
        continue;
      }

      configuredPackages.push({
        resourceKind: "package",
        source,
        scope,
        filtered: typeof packageSource === "object",
        installedPath: packageManager.getInstalledPath(source, scope),
        settingsPath,
      });
    }
  };

  const appendExtensions = (scope: "user" | "project", extensionPaths: string[]) => {
    const settingsPath = scope === "user" ? globalSettingsPath : projectSettingsPath;

    if (!settingsPath) {
      return;
    }

    for (const extensionPath of extensionPaths) {
      configuredPackages.push({
        resourceKind: "extension",
        source: extensionPath,
        scope,
        filtered: false,
        installedPath: resolveConfiguredExtensionPath(extensionPath, settingsPath),
        settingsPath,
      });
    }
  };

  const globalSettings = settingsManager.getGlobalSettings();
  const projectSettings = settingsManager.getProjectSettings();

  appendPackages("user", globalSettings.packages ?? []);
  appendPackages("project", projectSettings.packages ?? []);
  appendExtensions("user", globalSettings.extensions ?? []);
  appendExtensions("project", projectSettings.extensions ?? []);

  return sortConfiguredPackages(
    configuredPackages.map((configuredPackage) => ({
      resourceKind: configuredPackage.resourceKind,
      source: configuredPackage.source,
      identityKey: getPiPackageIdentityKey(configuredPackage.source),
      displayName: getConfiguredPiPackageDisplayName(configuredPackage.source),
      type: getConfiguredPiPackageType(configuredPackage.source),
      scope: configuredPackage.scope,
      filtered: configuredPackage.filtered,
      installedPath: configuredPackage.installedPath ?? null,
      settingsPath: configuredPackage.settingsPath,
    })),
  );
}
