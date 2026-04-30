import type { ResourceLoader, SettingsManager } from "@mariozechner/pi-coding-agent";
import path from "node:path";

type SettingsManagerFactory = {
  create: (cwd: string, agentDir?: string) => SettingsManager;
  inMemory: (settings?: Record<string, unknown>) => SettingsManager;
};

export function createRuntimeSettingsManager(options: {
  SettingsManager: SettingsManagerFactory;
  cwd: string;
  agentDir: string;
  settingsCwd?: string | null;
}) {
  const diskSettingsManager = options.SettingsManager.create(
    options.settingsCwd ?? options.cwd,
    options.agentDir,
  );

  if (!options.settingsCwd) {
    return diskSettingsManager;
  }

  const globalSettings = diskSettingsManager.getGlobalSettings();
  const projectSettings = diskSettingsManager.getProjectSettings();

  return options.SettingsManager.inMemory({
    ...globalSettings,
    ...projectSettings,
    packages: projectSettings.packages ?? [],
    extensions: projectSettings.extensions ?? [],
    skills: projectSettings.skills ?? [],
    prompts: projectSettings.prompts ?? [],
    themes: projectSettings.themes ?? [],
  });
}

export async function createIsolatedRuntimeResourceLoader(options: {
  DefaultResourceLoader: new (loaderOptions: {
    cwd: string;
    agentDir: string;
    settingsManager: SettingsManager;
    noSkills?: boolean;
    additionalSkillPaths?: string[];
  }) => ResourceLoader;
  cwd: string;
  agentDir: string;
  settingsCwd?: string | null;
  settingsManager: SettingsManager;
}) {
  if (!options.settingsCwd) {
    return undefined;
  }

  const resourceLoader = new options.DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    settingsManager: options.settingsManager,
    noSkills: true,
    additionalSkillPaths: [
      path.join(options.settingsCwd, ".pi", "skills"),
      path.join(options.settingsCwd, ".agents", "skills"),
    ],
  });
  await resourceLoader.reload();
  return resourceLoader;
}
