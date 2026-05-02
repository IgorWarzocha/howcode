import type { ComposerState } from "./desktop-composer-contracts";
import type { Artifact } from "./desktop-artifact-contracts";
import type { AppUpdateState } from "./desktop-app-update-contracts";
import type { DictationModelId } from "./desktop-dictation-contracts";
import type { ThreadData } from "./desktop-thread-contracts";

export type DesktopEvent =
  | {
      type: "app-update";
      state: AppUpdateState;
    }
  | {
      type: "shell-state-refresh";
    }
  | {
      type: "dictation-download-log";
      modelId: DictationModelId;
      message: string;
      at: string;
      done: boolean;
      isError: boolean;
    }
  | {
      type: "runtime-diagnostic";
      severity: "info" | "warning" | "error";
      message: string;
      details?: unknown;
      sessionPath?: string | null;
      projectId?: string | null;
    }
  | {
      type: "internal-thread-update";
      sessionPath: string;
    }
  | {
      type: "artifact-update";
      conversationId: string;
      artifact: Artifact;
    }
  | {
      type: "thread-update";
      reason: "start" | "update" | "end" | "external" | "compaction-start" | "compaction";
      projectId: string;
      threadId: string;
      sessionPath: string;
      chatGroupId?: string | null;
      isChat?: boolean;
      thread: ThreadData;
      composer: ComposerState | null;
    }
  | {
      type: "composer-update";
      projectId: string | null;
      sessionPath: string | null;
      composer: ComposerState;
    };
