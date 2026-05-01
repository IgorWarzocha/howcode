import { useRef, type RefObject } from "react";
import type {
  ComposerFilePickerState,
  ComposerContextUsage,
  ComposerModel,
  ComposerStreamingBehavior,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
} from "../../desktop/types";
import type { View } from "../../types";
import { ComposerPromptSurface } from "./composer/ComposerPromptSurface";
import type { SavedDiffComment } from "./diff/diffCommentStore";

export type ComposerProps = {
  activeView: View;
  model: ComposerModel | null;
  contextUsage: ComposerContextUsage | null;
  availableModels: ComposerModel[];
  isStreaming: boolean;
  replyActivityKey: string;
  isCompacting: boolean;
  isExtensionCommandRunning: boolean;
  thinkingLevel: ComposerThinkingLevel;
  restoredQueuedPrompt: string | null;
  streamingBehaviorPreference: ComposerStreamingBehavior;
  availableThinkingLevels: ComposerThinkingLevel[];
  projectId: string;
  chatGroupId?: string | null;
  projectGitState: ProjectGitState | null;
  diffBaseline: ProjectDiffBaseline;
  sessionPath: string | null;
  dictationModelId: string | null;
  dictationMaxDurationSeconds: number;
  favoriteFolders: string[];
  showDictationButton: boolean;
  diffRenderMode: ProjectDiffRenderMode;
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: ProjectDiffRenderMode) => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  promptResetKey: number;
  onOpenTakeoverTerminal: () => void;
  onOpenGitOpsView: () => void;
  onOpenSettingsView: () => void;
  onRestoredQueuedPromptApplied: () => void;
  onToggleTerminal: () => void;
  onToggleArtifacts?: () => void;
  showTerminalControls?: boolean;
  artifactsVisible?: boolean;
  artifactsAvailable?: boolean;
  terminalVisible: boolean;
  onLayoutChange: () => void;
  mainViewRef: RefObject<HTMLElement | null>;
  workspaceFooterRef: RefObject<HTMLElement | null>;
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
    <ComposerPromptSurface
      {...props}
      composerPanelRef={composerPanelRef}
      mainViewRef={props.mainViewRef}
      workspaceFooterRef={props.workspaceFooterRef}
      onOpenGitOps={props.onOpenGitOpsView}
    />
  );
}
