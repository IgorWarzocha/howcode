import type { ComposerState } from "./desktop-composer-contracts";
import type { DictationModelId } from "./desktop-dictation-contracts";
import type { ThreadData } from "./desktop-thread-contracts";

export type DesktopEvent =
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
      type: "thread-update";
      reason: "start" | "update" | "end" | "external" | "compaction";
      projectId: string;
      threadId: string;
      sessionPath: string;
      thread: ThreadData;
      composer: ComposerState | null;
    }
  | {
      type: "composer-update";
      projectId: string | null;
      sessionPath: string | null;
      composer: ComposerState;
    };
