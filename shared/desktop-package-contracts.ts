export type PiPackageCatalogItem = {
  name: string;
  version: string;
  description: string | null;
  keywords: string[];
  monthlyDownloads: number;
  weeklyDownloads: number;
  searchScore: number;
  publishedAt: string;
  updatedAt: string;
  npmUrl: string;
  homepageUrl: string | null;
  repositoryUrl: string | null;
  source: string;
  identityKey: string;
};

export type PiPackageCatalogPage = {
  query: string;
  sort: "monthlyDownloads-desc";
  total: number;
  nextCursor: number | null;
  items: PiPackageCatalogItem[];
};

export type PiConfiguredPackageType = "npm" | "git" | "local";

export type PiConfiguredPackage = {
  resourceKind: "package" | "extension";
  source: string;
  identityKey: string;
  displayName: string;
  type: PiConfiguredPackageType;
  scope: "user" | "project";
  filtered: boolean;
  installedPath: string | null;
  settingsPath: string | null;
};

export type PiPackageMutationResult = {
  source: string;
  normalizedSource: string;
  configuredPackages: PiConfiguredPackage[];
};

export type PiSkillCatalogItem = {
  id: string;
  skillId: string;
  name: string;
  source: string;
  installs: number;
  description: string | null;
  url: string;
  sourceUrl: string;
  identityKey: string;
};

export type PiSkillCatalogPage = {
  query: string;
  total: number;
  items: PiSkillCatalogItem[];
};

export type PiConfiguredSkill = {
  source: string;
  identityKey: string;
  displayName: string;
  description: string | null;
  scope: "user" | "project";
  provenance: "skills.sh" | "local";
  installedPath: string;
  skillFilePath: string;
  sourceRepo: string | null;
  sourceUrl: string | null;
};

export type PiSkillMutationResult = {
  source: string;
  normalizedSource: string;
  configuredSkills: PiConfiguredSkill[];
};

export type SkillCreatorSessionMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export type SkillCreatorSessionState = {
  sessionId: string;
  messages: SkillCreatorSessionMessage[];
  latestResponse: string | null;
  createdSkillPath: string | null;
};
