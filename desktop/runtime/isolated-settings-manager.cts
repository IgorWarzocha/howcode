import type { ResourceLoader, SettingsManager } from "@mariozechner/pi-coding-agent";
import path from "node:path";

type SettingsManagerFactory = {
  create: (cwd: string, agentDir?: string) => SettingsManager;
  inMemory: (settings?: Record<string, unknown>) => SettingsManager;
};

function mergeSettingsArrays(globalValue: unknown, projectValue: unknown) {
  const values = [
    ...(Array.isArray(globalValue) ? globalValue : []),
    ...(Array.isArray(projectValue) ? projectValue : []),
  ];
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
    packages: mergeSettingsArrays(globalSettings.packages, projectSettings.packages),
    extensions: mergeSettingsArrays(globalSettings.extensions, projectSettings.extensions),
    skills: mergeSettingsArrays(globalSettings.skills, projectSettings.skills),
    prompts: mergeSettingsArrays(globalSettings.prompts, projectSettings.prompts),
    themes: mergeSettingsArrays(globalSettings.themes, projectSettings.themes),
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
