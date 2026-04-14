import { useRef } from "react";
import type {
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../desktop/types";
import { SurfacePanel } from "../common/SurfacePanel";
import { ComposerGitOpsSurface } from "./composer/ComposerGitOpsSurface";
import type { SavedDiffComment } from "./diff/diffCommentStore";

type GitOpsComposerPanelProps = {
  projectGitState: ProjectGitState | null;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  onAction: DesktopActionInvoker;
  onLayoutChange: () => void;
  onBack: () => void;
};

export function GitOpsComposerPanel({
  projectGitState,
  diffBaseline,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onSendDiffComments,
  onSelectDiffComment,
  onAction,
  onLayoutChange,
  onBack,
}: GitOpsComposerPanelProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null);

  return (
    <SurfacePanel
      ref={composerPanelRef}
      className="grid gap-0 overflow-visible border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
      aria-label="Git ops composer panel"
    >
      <ComposerGitOpsSurface
        composerPanelRef={composerPanelRef}
        projectGitState={projectGitState}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        diffComments={diffComments}
        diffCommentCount={diffCommentCount}
        diffCommentsSending={diffCommentsSending}
        diffCommentError={diffCommentError}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onSendDiffComments={onSendDiffComments}
        onSelectDiffComment={onSelectDiffComment}
        onAction={onAction}
        onLayoutChange={onLayoutChange}
        onBack={onBack}
      />
    </SurfacePanel>
  );
}
