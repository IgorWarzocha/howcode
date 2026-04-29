import type { CommitMessageContext } from "../project-git.cts";
import type {
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopEvent,
  ComposerAttachment,
  PiSettings,
  PiConfiguredPackage,
  PiPackageMutationResult,
  ThreadData,
  SkillCreatorSessionState,
} from "../../shared/desktop-contracts.ts";

export type RuntimeHostRequestMap = {
  getComposerState: { request: ComposerStateRequest };
  getComposerSlashCommands: { request: ComposerStateRequest };
  startNewThread: { request: ComposerStateRequest };
  selectProjectRuntime: { request: ComposerStateRequest };
  openThreadRuntime: { request: ComposerStateRequest };
  getPiSessionStorage: { projectPath?: string | null };
  loadPiSettings: { projectPath?: string | null };
  updatePiSetting: { key: keyof PiSettings; value: unknown; projectPath?: string | null };
  listConfiguredPiPackages: { projectPath?: string | null };
  installPiPackage: {
    source: string;
    kind?: "npm" | "git";
    local?: boolean;
    projectPath?: string | null;
  };
  removePiPackage: { source: string; local?: boolean; projectPath?: string | null };
  loadThreadSnapshot: { sessionPath: string; historyCompactions?: number };
  startSkillCreatorSession: { prompt: string; local?: boolean; projectPath?: string | null };
  continueSkillCreatorSession: { sessionId: string; prompt: string };
  closeSkillCreatorSession: { sessionId: string };
  generateGitCommitMessage: { request: ComposerStateRequest; context: CommitMessageContext };
  setComposerModel: { request: ComposerStateRequest; provider: string; modelId: string };
  setComposerThinkingLevel: { request: ComposerStateRequest; level: ComposerThinkingLevel };
  sendComposerPrompt: ComposerStateRequest & {
    text: string;
    attachments?: ComposerAttachment[];
    streamingBehavior?: ComposerStreamingBehavior | null;
  };
  stopComposerRun: { request: ComposerStateRequest };
  dequeueComposerPrompt: ComposerStateRequest & {
    queueId: string;
    queueSnapshotKey: string;
    queueMode: Exclude<ComposerStreamingBehavior, "stop">;
  };
};

export type RuntimeHostResponseMap = {
  getComposerState: ComposerState;
  getComposerSlashCommands: ComposerSlashCommand[];
  startNewThread: {
    composer: ComposerState;
    projectId: string;
    sessionPath: string;
    threadId: string;
  };
  selectProjectRuntime: ComposerState;
  openThreadRuntime: ComposerState;
  getPiSessionStorage: { agentDir: string; sessionDir: string };
  loadPiSettings: PiSettings;
  updatePiSetting: PiSettings;
  listConfiguredPiPackages: PiConfiguredPackage[];
  installPiPackage: PiPackageMutationResult;
  removePiPackage: PiPackageMutationResult;
  loadThreadSnapshot: { projectId: string; threadId: string; thread: ThreadData };
  startSkillCreatorSession: SkillCreatorSessionState;
  continueSkillCreatorSession: SkillCreatorSessionState;
  closeSkillCreatorSession: { ok: boolean };
  generateGitCommitMessage: string | null;
  setComposerModel: { ok: true };
  setComposerThinkingLevel: { ok: true };
  sendComposerPrompt: "sent" | "stopped";
  stopComposerRun: { ok: true };
  dequeueComposerPrompt: string | null;
};

export type RuntimeHostRequestName = keyof RuntimeHostRequestMap;

export type RuntimeHostRequestMessage<
  TName extends RuntimeHostRequestName = RuntimeHostRequestName,
> = {
  type: "request";
  id: string;
  name: TName;
  payload: RuntimeHostRequestMap[TName];
};

export type RuntimeHostResponseMessage =
  | {
      type: "response";
      id: string;
      ok: true;
      result: RuntimeHostResponseMap[RuntimeHostRequestName];
    }
  | { type: "response"; id: string; ok: false; error: string; stack?: string };

export type RuntimeHostEventMessage = {
  type: "desktop-event";
  event: DesktopEvent;
};

export type RuntimeHostCrashMessage = {
  type: "host-error";
  error: string;
  stack?: string;
};

export type RuntimeHostToMainMessage =
  | RuntimeHostResponseMessage
  | RuntimeHostEventMessage
  | RuntimeHostCrashMessage;

export type RuntimeMainToHostMessage = RuntimeHostRequestMessage;
