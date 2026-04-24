import type { ComposerState, ComposerStreamingBehavior } from "./desktop-composer-contracts";
import type { DictationModelId } from "./desktop-dictation-contracts";
import type { Project } from "./desktop-thread-contracts";

export type ModelSelection = {
  provider: string;
  id: string;
};

export type ProjectDeletionMode = "pi-only" | "full-clean";

export type AppSettings = {
  gitCommitMessageModel: ModelSelection | null;
  skillCreatorModel: ModelSelection | null;
  composerStreamingBehavior: ComposerStreamingBehavior;
  dictationModelId: DictationModelId | null;
  dictationMaxDurationSeconds: number;
  showDictationButton: boolean;
  favoriteFolders: string[];
  projectImportState: boolean | null;
  preferredProjectLocation: string | null;
  initializeGitOnProjectCreate: boolean;
  projectDeletionMode: ProjectDeletionMode;
  useAgentsSkillsPaths: boolean;
  piTuiTakeover: boolean;
};

export type ShellState = {
  platform: string;
  mockMode: boolean;
  productName: string;
  cwd: string;
  resolvedCwd?: string;
  agentDir: string;
  sessionDir: string;
  projects: Project[];
  appSettings: AppSettings;
  availableHosts: string[];
  composer: ComposerState;
};
