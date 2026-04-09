import { existsSync } from "node:fs";
import path from "node:path";
import { getPiModule } from "../pi-module.cts";
import type { PiPackageManager, PiSettingsManager } from "./types.ts";

export async function getPiPackageServices(projectPath?: string | null): Promise<{
  packageManager: PiPackageManager;
  settingsManager: PiSettingsManager;
  agentDir: string;
}> {
  const { DefaultPackageManager, SettingsManager, getAgentDir } = await getPiModule();
  const agentDir = getAgentDir();
  const cwd = projectPath?.trim() ? path.resolve(projectPath) : agentDir;
  const settingsManager = SettingsManager.create(cwd, agentDir);

  return {
    packageManager: new DefaultPackageManager({
      cwd,
      agentDir,
      settingsManager,
    }) as unknown as PiPackageManager,
    settingsManager: settingsManager as unknown as PiSettingsManager,
    agentDir,
  };
}

export function resolveConfiguredExtensionPath(extensionPath: string, settingsPath: string) {
  const resolvedPath = path.isAbsolute(extensionPath)
    ? extensionPath
    : path.resolve(path.dirname(settingsPath), extensionPath);

  return existsSync(resolvedPath) ? resolvedPath : undefined;
}
