import type { CommitMessageContext } from "../project-git.cts";
import type { Artifact, ArtifactKind } from "../../shared/desktop-contracts.ts";
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
  PiConfiguredSkill,
  PiSkillMutationResult,
  ThreadData,
  SkillCreatorSessionState,
} from "../../shared/desktop-contracts.ts";

export type RuntimeHostRequestMap = {
  getComposerState: { request: ComposerStateRequest };
  getComposerSlashCommands: { request: ComposerStateRequest };
  startNewThread: { request: ComposerStateRequest };
  selectProjectRuntime: { request: ComposerStateRequest };
  openThreadRuntime: { request: ComposerStateRequest };
  invalidateRuntimeSettings: {
    sessionPath?: string | null;
    projectPath?: string | null;
    chat?: boolean;
  };
  getPiSessionStorage: { projectPath?: string | null; chat?: boolean };
  loadPiSettings: { projectPath?: string | null; chat?: boolean };
  updatePiSetting: {
    key: keyof PiSettings;
    value: unknown;
    projectPath?: string | null;
    chat?: boolean;
  };
  listConfiguredPiPackages: { projectPath?: string | null; chat?: boolean };
  installPiPackage: {
    source: string;
    kind?: "npm" | "git";
    local?: boolean;
    projectPath?: string | null;
    chat?: boolean;
  };
  removePiPackage: { source: string; local?: boolean; projectPath?: string | null; chat?: boolean };
  listConfiguredPiSkills: { projectPath?: string | null; chat?: boolean };
  installPiSkill: { source: string; local?: boolean; projectPath?: string | null; chat?: boolean };
  removePiSkill: { installedPath: string; projectPath?: string | null; chat?: boolean };
  loadThreadSnapshot: { sessionPath: string; historyCompactions?: number };
  startSkillCreatorSession: {
    prompt: string;
    local?: boolean;
    projectPath?: string | null;
    chat?: boolean;
  };
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
  invalidateRuntimeSettings: { ok: true };
  getPiSessionStorage: { agentDir: string; sessionDir: string };
  loadPiSettings: PiSettings;
  updatePiSetting: PiSettings;
  listConfiguredPiPackages: PiConfiguredPackage[];
  installPiPackage: PiPackageMutationResult;
  removePiPackage: PiPackageMutationResult;
  listConfiguredPiSkills: PiConfiguredSkill[];
  installPiSkill: PiSkillMutationResult;
  removePiSkill: PiSkillMutationResult;
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

export type RuntimeHostMainRequestMap = {
  createArtifact: {
    conversationId: string;
    slug: string;
    kind: ArtifactKind;
    content: string;
  };
  updateArtifact: { slug: string; content: string; conversationId?: string | null };
  editArtifact: {
    slug: string;
    conversationId?: string | null;
    edits: Array<{ oldText: string; newText: string }>;
  };
  getArtifact: { artifactSlug: string; conversationId?: string | null };
  listArtifacts: { conversationId: string };
};

export type RuntimeHostMainResponseMap = {
  createArtifact: Artifact;
  updateArtifact: Artifact;
  editArtifact: Artifact;
  getArtifact: Artifact | null;
  listArtifacts: Artifact[];
};

export type RuntimeHostMainRequestName = keyof RuntimeHostMainRequestMap;

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

export type RuntimeHostMainRequestMessage<
  TName extends RuntimeHostMainRequestName = RuntimeHostMainRequestName,
> = {
  type: "main-request";
  id: string;
  name: TName;
  payload: RuntimeHostMainRequestMap[TName];
};

export type RuntimeHostMainResponseMessage =
  | {
      type: "main-response";
      id: string;
      ok: true;
      result: RuntimeHostMainResponseMap[RuntimeHostMainRequestName];
    }
  | { type: "main-response"; id: string; ok: false; error: string; stack?: string };

export type RuntimeHostToMainMessage =
  | RuntimeHostResponseMessage
  | RuntimeHostEventMessage
  | RuntimeHostCrashMessage
  | RuntimeHostMainRequestMessage;

export type RuntimeMainToHostMessage = RuntimeHostRequestMessage | RuntimeHostMainResponseMessage;
