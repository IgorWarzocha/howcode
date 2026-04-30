import type { SettingsManager } from "@mariozechner/pi-coding-agent";

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
