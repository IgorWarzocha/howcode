import { useRef } from "react";
import type {
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../desktop/types";
import { ComposerGitOpsSurface } from "./composer/ComposerGitOpsSurface";
import type { SavedDiffComment } from "./diff/diffCommentStore";

type GitOpsComposerPanelProps = {
  dictationModelId: string | null;
  dictationMaxDurationSeconds: number;
  projectGitState: ProjectGitState | null;
  projectId: string;
  sessionPath: string | null;
  showDictationButton: boolean;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  diffLoadError: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  onAction: DesktopActionInvoker;
  onLayoutChange: () => void;
  onBack: () => void;
  onOpenSettingsView: () => void;
};

export function GitOpsComposerPanel({
  dictationModelId,
  dictationMaxDurationSeconds,
  projectGitState,
  projectId,
  sessionPath,
  showDictationButton,
  diffBaseline,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  diffLoadError,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onSendDiffComments,
  onSelectDiffComment,
  onAction,
  onLayoutChange,
  onBack,
  onOpenSettingsView,
}: GitOpsComposerPanelProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={composerPanelRef}
      className="grid gap-0 overflow-visible rounded-[20px] border border-[rgba(169,178,215,0.06)] bg-[#272a39] shadow-none"
      aria-label="Git ops composer panel"
    >
      <ComposerGitOpsSurface
        dictationModelId={dictationModelId}
        dictationMaxDurationSeconds={dictationMaxDurationSeconds}
        composerPanelRef={composerPanelRef}
        onOpenSettingsView={onOpenSettingsView}
        projectGitState={projectGitState}
        projectId={projectId}
        sessionPath={sessionPath}
        showDictationButton={showDictationButton}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        diffComments={diffComments}
        diffCommentCount={diffCommentCount}
        diffCommentsSending={diffCommentsSending}
        diffCommentError={diffCommentError}
        diffLoadError={diffLoadError}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onSendDiffComments={onSendDiffComments}
        onSelectDiffComment={onSelectDiffComment}
        onAction={onAction}
        onLayoutChange={onLayoutChange}
        onBack={onBack}
      />
    </div>
  );
}
