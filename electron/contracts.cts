import { type DesktopAction, desktopActions } from "../shared/desktop-actions.js";
import type {
  DesktopActionPayload,
  DesktopActionResult,
  ShellState,
  ThreadData,
} from "../shared/desktop-contracts.js";

export const IPC_CHANNELS = {
  getShellState: "pi:get-shell-state",
  getThread: "pi:get-thread",
  invokeAction: "pi:invoke-action",
} as const;

export const DEFAULT_SHELL_STATE: Readonly<ShellState> = Object.freeze({
  platform: process.platform,
  mockMode: true,
  productName: "Pi Desktop Mock",
  cwd: process.cwd(),
  agentDir: "",
  sessionDir: "",
  projects: [],
  availableHosts: ["Local"],
  composerProfiles: ["Pi session"],
});

export type GetThreadRequest = {
  sessionPath: string;
};

export type InvokeActionRequest = {
  action: DesktopAction;
  payload?: DesktopActionPayload;
};

export function isDesktopAction(action: unknown): action is DesktopAction {
  return typeof action === "string" && desktopActions.includes(action as DesktopAction);
}

export type { DesktopAction, DesktopActionPayload, DesktopActionResult, ShellState, ThreadData };
