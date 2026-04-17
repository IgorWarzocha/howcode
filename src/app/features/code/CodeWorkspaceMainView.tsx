import { Suspense, lazy } from "react";
import type {
  AppSettings,
  ArchivedThread,
  ComposerModel,
  DesktopActionInvoker,
  InboxThread,
  ThreadData,
} from "../../desktop/types";
import type { Project, View } from "../../types";
import { ArchivedThreadsView } from "../../views/ArchivedThreadsView";
import { InboxView } from "../../views/InboxView";
import { LandingView } from "../../views/LandingView";
import { SettingsView } from "../../views/SettingsView";
import { ThreadView } from "../../views/ThreadView";

const ExtensionsView = lazy(async () => {
  const module = await import("../extensions/ExtensionsView");
  return { default: module.ExtensionsView };
});

const SkillsView = lazy(async () => {
  const module = await import("../skills/SkillsView");
  return { default: module.SkillsView };
});

type CodeWorkspaceMainViewProps = {
  activeView: View;
  appSettings: AppSettings;
  archivedThreads: ArchivedThread[];
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  currentProjectName: string;
  selectedInboxThread: InboxThread | null;
  projects: Project[];
  selectedProjectId: string;
  workspaceContentClass: string;
  threadData: ThreadData | null;
  composerLayoutVersion: number;
  onAction: DesktopActionInvoker;
  onDismissInboxThread: (thread: InboxThread) => void;
  onCloseUtilityView: () => void;
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void;
  onLoadEarlierMessages: () => void;
  onSetExtensionsProjectScopeActive: (active: boolean) => void;
  onSetSkillsProjectScopeActive: (active: boolean) => void;
  onSelectProject: (projectId: string) => void;
};

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  archivedThreads,
  availableModels,
  currentModel,
  currentProjectName,
  selectedInboxThread,
  projects,
  selectedProjectId,
  workspaceContentClass,
  threadData,
  composerLayoutVersion,
  onAction,
  onDismissInboxThread,
  onCloseUtilityView,
  onOpenThread,
  onLoadEarlierMessages,
  onSetExtensionsProjectScopeActive,
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
        composerLayoutVersion={composerLayoutVersion}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    );
  }

  if (activeView === "inbox") {
    return (
      <InboxView
        key={selectedInboxThread?.sessionPath ?? "inbox-empty"}
        appSettings={appSettings}
        thread={selectedInboxThread}
        onAction={onAction}
        onDismissThread={onDismissInboxThread}
        onOpenThread={onOpenThread}
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
        onClose={onCloseUtilityView}
      />
    );
  }

  if (activeView === "archived") {
    return <ArchivedThreadsView threads={archivedThreads} onAction={onAction} />;
  }

  if (activeView === "extensions") {
    return (
      <Suspense
        fallback={
          <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
            <div className="grid gap-1">
              <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Extensions</h1>
              <p className="m-0 text-[13px] text-[color:var(--muted)]">Loading packages…</p>
            </div>
          </div>
        }
      >
        <ExtensionsView
          projectPath={selectedProjectId || null}
          onSetProjectScopeActive={onSetExtensionsProjectScopeActive}
          onClose={onCloseUtilityView}
        />
      </Suspense>
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
          onClose={onCloseUtilityView}
        />
      </Suspense>
    );
  }

  return (
    <div className="grid h-full content-start justify-items-center overflow-y-auto px-4 pb-6">
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
