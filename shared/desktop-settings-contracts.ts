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

export type PiTransportMode = "sse" | "websocket" | "auto";
export type PiQueueMode = "all" | "one-at-a-time";
export type PiDoubleEscapeAction = "fork" | "tree" | "none";
export type PiTreeFilterMode = "default" | "no-tools" | "user-only" | "labeled-only" | "all";

export type PiSettings = {
  autoCompact: boolean;
  enableSkillCommands: boolean;
  hideThinkingBlock: boolean;
  quietStartup: boolean;
  showImages: boolean;
  autoResizeImages: boolean;
  blockImages: boolean;
  collapseChangelog: boolean;
  enableInstallTelemetry: boolean;
  showHardwareCursor: boolean;
  clearOnShrink: boolean;
  transport: PiTransportMode;
  steeringMode: PiQueueMode;
  followUpMode: PiQueueMode;
  doubleEscapeAction: PiDoubleEscapeAction;
  treeFilterMode: PiTreeFilterMode;
  editorPaddingX: number;
  autocompleteMaxVisible: number;
  imageWidthCells: number;
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
  piSettings: PiSettings;
  availableHosts: string[];
  composer: ComposerState;
};
