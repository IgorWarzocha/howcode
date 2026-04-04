import { DiffPanelContent } from "./diff/DiffPanelContent";
import { DiffWorkerPoolProvider } from "./diff/DiffWorkerPoolProvider";

type DiffPanelProps = {
  projectId: string;
  isGitRepo: boolean;
  selectedFilePath: string | null;
  selectedCommentId: string | null;
  selectedCommentJumpKey: number;
  diffRenderMode: "stacked" | "split";
  layoutMode?: "split" | "overlay" | "main";
};

export function DiffPanel({
  projectId,
  isGitRepo,
  selectedFilePath,
  selectedCommentId,
  selectedCommentJumpKey,
  diffRenderMode,
  layoutMode = "split",
}: DiffPanelProps) {
  return (
    <DiffWorkerPoolProvider>
      <DiffPanelContent
        projectId={projectId}
        isGitRepo={isGitRepo}
        selectedFilePath={selectedFilePath}
        selectedCommentId={selectedCommentId}
        selectedCommentJumpKey={selectedCommentJumpKey}
        diffRenderMode={diffRenderMode}
        layoutMode={layoutMode}
      />
    </DiffWorkerPoolProvider>
  );
}
