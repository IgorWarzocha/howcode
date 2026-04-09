import { Suspense, lazy } from "react";
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

const SkillsView = lazy(async () => {
  const module = await import("../../views/SkillsView");
  return { default: module.SkillsView };
});

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
  onSetSkillsProjectScopeActive: (active: boolean) => void;
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
  onSetSkillsProjectScopeActive,
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
        projects={projects}
        onAction={onAction}
      />
    );
  }

  if (activeView === "skills") {
    return (
      <Suspense
        fallback={
          <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
            <div className="grid gap-1">
              <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Skills</h1>
              <p className="m-0 text-[13px] text-[color:var(--muted)]">Loading skills…</p>
            </div>
          </div>
        }
      >
        <SkillsView
          appSettings={appSettings}
          projectPath={selectedProjectId || null}
          onSetProjectScopeActive={onSetSkillsProjectScopeActive}
          onAction={onAction}
        />
      </Suspense>
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
        onSelectProject={onSelectProject}
      />
    </div>
  );
}
