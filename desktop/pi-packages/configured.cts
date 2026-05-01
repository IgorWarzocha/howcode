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
  const scopeRank: Record<PiConfiguredPackage["scope"], number> = {
    user: 0,
    project: 1,
    chat: 2,
  };

  return [...packages].sort((left, right) => {
    if (left.scope !== right.scope) {
      return scopeRank[left.scope] - scopeRank[right.scope];
    }

    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
}

export async function listConfiguredPiPackages(
  request: {
    projectPath?: string | null;
    chat?: boolean;
  } = {},
): Promise<PiConfiguredPackage[]> {
  const { packageManager, settingsManager, agentDir, projectPath } = await getPiPackageServices({
    projectPath: request.projectPath,
  });
  const chatServices = request.chat ? await getPiPackageServices({ chat: true }) : null;
  const configuredPackages: PiConfiguredPackageRecord[] = [];
  const globalSettingsPath = path.join(agentDir, "settings.json");
  const projectSettingsPath = projectPath ? path.join(projectPath, ".pi", "settings.json") : null;
  const chatSettingsPath = chatServices?.projectPath
    ? path.join(chatServices.projectPath, ".pi", "settings.json")
    : null;

  const appendPackages = (
    scope: "user" | "project" | "chat",
    packageSources: PiSettingsPackageSource[],
    settingsPath: string | null,
  ) => {
    for (const packageSource of packageSources) {
      const source = typeof packageSource === "string" ? packageSource : packageSource.source;

      if (!settingsPath) {
        continue;
      }

      configuredPackages.push({
        resourceKind: "package",
        source,
        scope,
        filtered: typeof packageSource === "object",
        installedPath:
          scope === "chat"
            ? chatServices?.packageManager.getInstalledPath(source, "project")
            : packageManager.getInstalledPath(source, scope === "user" ? "user" : "project"),
        settingsPath,
      });
    }
  };

  const appendExtensions = (
    scope: "user" | "project" | "chat",
    extensionPaths: string[],
    settingsPath: string | null,
  ) => {
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
  const chatSettings = chatServices?.settingsManager.getProjectSettings();

  appendPackages("user", globalSettings.packages ?? [], globalSettingsPath);
  appendExtensions("user", globalSettings.extensions ?? [], globalSettingsPath);
  appendPackages("project", projectSettings.packages ?? [], projectSettingsPath);
  appendExtensions("project", projectSettings.extensions ?? [], projectSettingsPath);
  appendPackages("chat", chatSettings?.packages ?? [], chatSettingsPath);
  appendExtensions("chat", chatSettings?.extensions ?? [], chatSettingsPath);

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
