import type { DesktopAction } from "../../desktop/actions";
import type { ThreadData } from "../../desktop/types";
import { DiffPanelContent } from "./diff/DiffPanelContent";
import { DiffWorkerPoolProvider } from "./diff/DiffWorkerPoolProvider";

type DiffPanelProps = {
  projectId: string;
  threadData: ThreadData | null;
  isGitRepo: boolean;
  selectedTurnCount: number | null;
  selectedFilePath: string | null;
  onSelectTurn: (checkpointTurnCount: number | null) => void;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function DiffPanel({
  projectId,
  threadData,
  isGitRepo,
  selectedTurnCount,
  selectedFilePath,
  onSelectTurn,
  onAction,
}: DiffPanelProps) {
  return (
    <DiffWorkerPoolProvider>
      <DiffPanelContent
        projectId={projectId}
        threadData={threadData}
        isGitRepo={isGitRepo}
        selectedTurnCount={selectedTurnCount}
        selectedFilePath={selectedFilePath}
        onSelectTurn={onSelectTurn}
        onAction={onAction}
      />
    </DiffWorkerPoolProvider>
  );
}
