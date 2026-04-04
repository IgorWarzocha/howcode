import { DiffPanelContent } from "./diff/DiffPanelContent";
import { DiffWorkerPoolProvider } from "./diff/DiffWorkerPoolProvider";

type DiffPanelProps = {
  projectId: string;
  isGitRepo: boolean;
  selectedFilePath: string | null;
  diffRenderMode: "stacked" | "split";
  layoutMode?: "split" | "overlay" | "main";
};

export function DiffPanel({
  projectId,
  isGitRepo,
  selectedFilePath,
  diffRenderMode,
  layoutMode = "split",
}: DiffPanelProps) {
  return (
    <DiffWorkerPoolProvider>
      <DiffPanelContent
        projectId={projectId}
        isGitRepo={isGitRepo}
        selectedFilePath={selectedFilePath}
        diffRenderMode={diffRenderMode}
        layoutMode={layoutMode}
      />
    </DiffWorkerPoolProvider>
  );
}
