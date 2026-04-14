import { useRef } from "react";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../desktop/types";
import type { View } from "../../types";
import { SurfacePanel } from "../common/SurfacePanel";
import { ComposerPromptSurface } from "./composer/ComposerPromptSurface";
import type { SavedDiffComment } from "./diff/diffCommentStore";

export type ComposerProps = {
  activeView: View;
  hostLabel: string;
  model: ComposerModel | null;
  availableModels: ComposerModel[];
  thinkingLevel: ComposerThinkingLevel;
  availableThinkingLevels: ComposerThinkingLevel[];
  projectId: string;
  projectGitState: ProjectGitState | null;
  diffBaseline: ProjectDiffBaseline;
  sessionPath: string | null;
  favoriteFolders: string[];
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
  onToggleTerminal: () => void;
  terminalVisible: boolean;
  onLayoutChange: () => void;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
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
    <SurfacePanel
      ref={composerPanelRef}
      className="grid gap-0 overflow-visible border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
      aria-label="Composer panel"
    >
      <ComposerPromptSurface
        {...props}
        composerPanelRef={composerPanelRef}
        onOpenGitOps={props.onOpenGitOpsView}
      />
    </SurfacePanel>
  );
}
