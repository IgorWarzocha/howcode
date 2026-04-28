import type {
  ComposerSlashCommand,
  ComposerState,
  ComposerStateRequest,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopEvent,
  ComposerAttachment,
} from "../../shared/desktop-contracts.ts";

export type RuntimeHostRequestMap = {
  getComposerState: { request: ComposerStateRequest };
  getComposerSlashCommands: { request: ComposerStateRequest };
  startNewThread: { request: ComposerStateRequest };
  selectProjectRuntime: { request: ComposerStateRequest };
  openThreadRuntime: { request: ComposerStateRequest };
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
