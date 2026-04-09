export type PiConfiguredPackageRecord = {
  resourceKind: "package" | "extension";
  source: string;
  scope: "user" | "project";
  filtered: boolean;
  installedPath?: string;
  settingsPath: string;
};

export type PiSettingsPackageSource =
  | string
  | {
      source: string;
      extensions?: string[];
      skills?: string[];
      prompts?: string[];
      themes?: string[];
    };

export type PiSettingsManager = {
  getGlobalSettings: () => { packages?: PiSettingsPackageSource[]; extensions?: string[] };
  getProjectSettings: () => { packages?: PiSettingsPackageSource[]; extensions?: string[] };
};

export type PiPackageManager = {
  getInstalledPath: (source: string, scope: "user" | "project") => string | undefined;
  installAndPersist: (source: string, options?: { local?: boolean }) => Promise<void>;
  removeAndPersist: (source: string, options?: { local?: boolean }) => Promise<boolean>;
};
