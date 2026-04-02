import type { DesktopAction } from "./desktop-actions.js";

export type Thread = {
  id: string;
  title: string;
  age: string;
  sessionPath?: string;
  summary?: string;
  pinned?: boolean;
};

export type Project = {
  id: string;
  name: string;
  threads: Thread[];
  collapsed?: boolean;
  threadsLoaded?: boolean;
  threadCount?: number;
};

export type ArchivedThread = {
  id: string;
  title: string;
  age: string;
  projectId: string;
  projectName: string;
  sessionPath: string;
};

export type Message = {
  id: string;
  role: "assistant" | "user";
  format?: "prose" | "list";
  content: string[];
};

export type ComposerThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

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
};

export type ShellState = {
  platform: string;
  mockMode: boolean;
  productName: string;
  cwd: string;
  agentDir: string;
  sessionDir: string;
  projects: Project[];
  availableHosts: string[];
  composerProfiles: string[];
  composer: ComposerState;
};

export type ThreadData = {
  sessionPath: string;
  title: string;
  messages: Message[];
  previousMessageCount: number;
};

export type DesktopActionPayload = Record<string, unknown>;

export type DesktopActionResult = {
  ok: boolean;
  at: string;
  payload: {
    action: DesktopAction;
    payload: DesktopActionPayload;
  };
};
