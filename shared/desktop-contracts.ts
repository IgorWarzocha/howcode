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
  subtitle?: string;
  threads: Thread[];
  collapsed?: boolean;
};

export type Message = {
  id: string;
  role: "assistant" | "user";
  format?: "prose" | "list";
  content: string[];
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
