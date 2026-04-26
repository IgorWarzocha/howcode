export type ComposerThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ComposerStreamingBehavior = "steer" | "followUp" | "stop";

export type ComposerQueuedPrompt = {
  id: string;
  mode: Exclude<ComposerStreamingBehavior, "stop">;
  queueIndex: number;
  queueSnapshotKey: string;
  text: string;
};

export type ComposerModel = {
  provider: string;
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
};

export type ComposerState = {
  currentModel: ComposerModel | null;
  availableModels: ComposerModel[];
  currentThinkingLevel: ComposerThinkingLevel;
  availableThinkingLevels: ComposerThinkingLevel[];
  queuedPrompts: ComposerQueuedPrompt[];
};

export type ComposerAttachment = {
  path: string;
  name: string;
  kind: "directory" | "text" | "image";
};

export type ComposerFilePickerEntry = {
  path: string;
  name: string;
  kind: "directory" | "text" | "image";
};

export type ComposerFilePickerState = {
  homePath: string;
  rootPath: string;
  currentPath: string;
  parentPath: string | null;
  entries: ComposerFilePickerEntry[];
};

export type ComposerStateRequest = {
  projectId?: string | null;
  sessionPath?: string | null;
};

export type ComposerSlashCommandSource = "app" | "builtin" | "extension" | "prompt" | "skill";

export type ComposerSlashCommand = {
  name: string;
  description?: string;
  source: ComposerSlashCommandSource;
  sourceInfo?: unknown;
};
