import { type DesktopAction, desktopActions } from "../shared/desktop-actions.js";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  DesktopActionPayload,
  DesktopActionResult,
  DesktopEvent,
  ShellState,
  Thread,
  ThreadData,
} from "../shared/desktop-contracts.js";

export const IPC_CHANNELS = {
  getShellState: "pi:get-shell-state",
  pickComposerAttachments: "pi:pick-composer-attachments",
  getComposerState: "pi:get-composer-state",
  getProjectThreads: "pi:get-project-threads",
  getArchivedThreads: "pi:get-archived-threads",
  getThread: "pi:get-thread",
  invokeAction: "pi:invoke-action",
  desktopEvent: "pi:desktop-event",
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
  composer: {
    currentModel: null,
    availableModels: [],
    currentThinkingLevel: "off" as const,
    availableThinkingLevels: ["off" as const],
  },
});

export type GetThreadRequest = {
  sessionPath: string;
};

export type GetComposerStateRequest = ComposerStateRequest;

export type PickComposerAttachmentsRequest = {
  projectId?: string | null;
};

export type GetProjectThreadsRequest = {
  projectId: string;
};

export type InvokeActionRequest = {
  action: DesktopAction;
  payload?: DesktopActionPayload;
};

export function isDesktopAction(action: unknown): action is DesktopAction {
  return typeof action === "string" && desktopActions.includes(action as DesktopAction);
}

export type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  DesktopEvent,
  DesktopAction,
  DesktopActionPayload,
  DesktopActionResult,
  ShellState,
  Thread,
  ThreadData,
};
