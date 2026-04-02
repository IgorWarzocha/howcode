import type { Message, Project } from "../types";
import type { DesktopAction } from "./actions";

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
