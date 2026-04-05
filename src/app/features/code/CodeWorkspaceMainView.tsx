import type { DesktopAction } from "../../desktop/actions";
import type {
  AppSettings,
  ComposerModel,
  DesktopActionResult,
  ThreadData,
} from "../../desktop/types";
import type { Project, View } from "../../types";
import { LandingView } from "../../views/LandingView";
import { SettingsView } from "../../views/SettingsView";
import { ThreadView } from "../../views/ThreadView";

type CodeWorkspaceMainViewProps = {
  activeView: View;
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  currentProjectName: string;
  projects: Project[];
  selectedProjectId: string;
  workspaceContentClass: string;
  threadData: ThreadData | null;
  composerLayoutVersion: number;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
  onOpenSettings: () => void;
  onSelectProject: (projectId: string) => void;
};

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  availableModels,
  currentModel,
  currentProjectName,
  projects,
  selectedProjectId,
  workspaceContentClass,
  threadData,
  composerLayoutVersion,
  onAction,
  onOpenTurnDiff,
  onLoadEarlierMessages,
  onOpenSettings,
  onSelectProject,
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
    <div className="grid h-full content-start justify-items-center px-4 pb-6">
      <LandingView
        appSettings={appSettings}
        className={workspaceContentClass}
        projectName={currentProjectName}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onAction={onAction}
        onOpenSettings={onOpenSettings}
        onSelectProject={onSelectProject}
      />
    </div>
  );
}
