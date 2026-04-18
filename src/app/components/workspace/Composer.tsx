import { useRef } from "react";
import type {
  ComposerFilePickerState,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../desktop/types";
import type { View } from "../../types";
import { ComposerPromptSurface } from "./composer/ComposerPromptSurface";
import type { SavedDiffComment } from "./diff/diffCommentStore";

export type ComposerProps = {
  activeView: View;
  hostLabel: string;
  model: ComposerModel | null;
  availableModels: ComposerModel[];
  isStreaming: boolean;
  thinkingLevel: ComposerThinkingLevel;
  restoredQueuedPrompt: string | null;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  availableThinkingLevels: ComposerThinkingLevel[];
  projectId: string;
  projectGitState: ProjectGitState | null;
  diffBaseline: ProjectDiffBaseline;
  sessionPath: string | null;
  dictationModelId: string | null;
  dictationMaxDurationSeconds: number;
  favoriteFolders: string[];
  showDictationButton: boolean;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  promptResetKey: number;
  onOpenTakeoverTerminal: () => void;
  onOpenGitOpsView: () => void;
  onOpenSettingsView: () => void;
  onRestoredQueuedPromptApplied: () => void;
  onToggleTerminal: () => void;
  terminalVisible: boolean;
  onLayoutChange: () => void;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
  onAction: DesktopActionInvoker;
};

export function Composer(props: ComposerProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={composerPanelRef}
      className="grid gap-0 overflow-visible rounded-[20px] border border-[rgba(169,178,215,0.06)] bg-[#272a39] shadow-none"
      aria-label="Composer panel"
    >
      <ComposerPromptSurface
        {...props}
        composerPanelRef={composerPanelRef}
        onOpenGitOps={props.onOpenGitOpsView}
      />
    </div>
  );
}
