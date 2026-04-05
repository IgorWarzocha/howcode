import type { DesktopAction } from "../../desktop/actions";
import type { AppSettings, ComposerModel, ThreadData } from "../../desktop/types";
import type { View } from "../../types";
import { LandingView } from "../../views/LandingView";
import { SettingsView } from "../../views/SettingsView";
import { ThreadView } from "../../views/ThreadView";

type CodeWorkspaceMainViewProps = {
  activeView: View;
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  currentProjectName: string;
  threadData: ThreadData | null;
  composerLayoutVersion: number;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  availableModels,
  currentModel,
  currentProjectName,
  threadData,
  composerLayoutVersion,
  onAction,
  onOpenTurnDiff,
  onLoadEarlierMessages,
}: CodeWorkspaceMainViewProps) {
  if (activeView === "thread") {
    return (
      <ThreadView
        key={threadData?.sessionPath ?? "new-thread"}
        messages={threadData?.messages ?? []}
        previousMessageCount={threadData?.previousMessageCount ?? 0}
        isStreaming={threadData?.isStreaming ?? false}
        turnDiffSummaries={threadData?.turnDiffSummaries ?? []}
        composerLayoutVersion={composerLayoutVersion}
        onOpenTurnDiff={onOpenTurnDiff}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    );
  }

  if (activeView === "settings") {
    return (
      <SettingsView
        appSettings={appSettings}
        availableModels={availableModels}
        currentModel={currentModel}
        onAction={onAction}
      />
    );
  }

  return (
    <div className="grid h-full place-items-center px-4 pb-6">
      <LandingView projectName={currentProjectName} onAction={onAction} />
    </div>
  );
}
