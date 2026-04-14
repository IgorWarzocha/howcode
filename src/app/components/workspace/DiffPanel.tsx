import type { ProjectDiffBaseline } from "../../desktop/types";
import { DiffPanelContent } from "./diff/DiffPanelContent";
import { DiffWorkerPoolProvider } from "./diff/DiffWorkerPoolProvider";

type DiffPanelProps = {
  projectId: string;
  isGitRepo: boolean;
  baseline: ProjectDiffBaseline | null;
  selectedFilePath: string | null;
  selectedCommentId: string | null;
  selectedCommentJumpKey: number;
  diffRenderMode: "stacked" | "split";
  bottomInset?: number;
  layoutMode?: "split" | "overlay" | "main";
};

export function DiffPanel({
  projectId,
  isGitRepo,
  baseline,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  bottomInset = 0,
  layoutMode = "split",
}: DiffPanelProps) {
  return (
    <DiffWorkerPoolProvider>
      <DiffPanelContent
        projectId={projectId}
        isGitRepo={isGitRepo}
        baseline={baseline}
        selectedFilePath={selectedFilePath}
        selectedCommentId={selectedCommentId}
        selectedCommentJumpKey={selectedCommentJumpKey}
        diffRenderMode={diffRenderMode}
        bottomInset={bottomInset}
        layoutMode={layoutMode}
      />
    </DiffWorkerPoolProvider>
  );
}
