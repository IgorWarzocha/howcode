import { Suspense, lazy } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type {
  AppSettings,
  ArchivedThread,
  ComposerModel,
  ComposerContextUsage,
  ComposerFilePickerState,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  InboxThread,
  PiSettings,
  PiThemeState,
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
  piSettings: PiSettings;
  piTheme: PiThemeState | null;
  archivedThreads: ArchivedThread[];
  availableModels: ComposerModel[];
  availableThinkingLevels: ComposerThinkingLevel[];
  contextUsage: ComposerContextUsage | null;
  currentModel: ComposerModel | null;
  currentThinkingLevel: ComposerThinkingLevel;
  isCompacting: boolean;
  currentProjectName: string;
  selectedInboxThread: InboxThread | null;
  projects: Project[];
  selectedProjectId: string;
  workspaceContentClass: string;
  threadData: ThreadData | null;
  threadLoading?: boolean;
  composerLayoutVersion: number;
  composerOverlayHeight: number;
  onAction: DesktopActionInvoker;
  onDismissInboxThread: (thread: InboxThread) => void;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
  onCloseUtilityView: () => void;
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void;
  onOpenSettingsView: () => void;
  onLoadEarlierMessages: () => void;
  onSetExtensionsProjectScopeActive: (active: boolean) => void;
  onSetSkillsProjectScopeActive: (active: boolean) => void;
  onSelectProject: (projectId: string) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export function CodeWorkspaceMainView({
  activeView,
  appSettings,
  piSettings,
  piTheme,
  archivedThreads,
  availableModels,
  availableThinkingLevels,
  contextUsage,
  currentModel,
  currentThinkingLevel,
  isCompacting,
  currentProjectName,
  selectedInboxThread,
  projects,
  selectedProjectId,
  workspaceContentClass,
  threadData,
  threadLoading = false,
  composerLayoutVersion,
  composerOverlayHeight,
  onAction,
  onDismissInboxThread,
  onListAttachmentEntries,
  onCloseUtilityView,
  onOpenThread,
  onOpenSettingsView,
  onLoadEarlierMessages,
  onSetExtensionsProjectScopeActive,
  onSetSkillsProjectScopeActive,
  onSelectProject,
  sidebarCollapsed,
  onToggleSidebar,
}: CodeWorkspaceMainViewProps) {
  if (activeView === "thread") {
    return (
      <ThreadView
        key={threadData?.sessionPath ?? "new-thread"}
        messages={threadData?.messages ?? []}
        previousMessageCount={threadData?.previousMessageCount ?? 0}
        isStreaming={threadData?.isStreaming ?? false}
        isCompacting={threadData?.isCompacting ?? false}
        composerLayoutVersion={composerLayoutVersion}
        composerOverlayHeight={composerOverlayHeight}
        loading={threadLoading}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    );
  }

  if (activeView === "inbox") {
    return (
      <InboxView
        key={selectedInboxThread?.sessionPath ?? "inbox-empty"}
        appSettings={appSettings}
        availableModels={availableModels}
        availableThinkingLevels={availableThinkingLevels}
        contextUsage={contextUsage}
        currentModel={currentModel}
        currentThinkingLevel={currentThinkingLevel}
        favoriteFolders={appSettings.favoriteFolders}
        isCompacting={isCompacting}
        showDictationButton={appSettings.showDictationButton}
        thread={selectedInboxThread}
        onAction={onAction}
        onDismissThread={onDismissInboxThread}
        onListAttachmentEntries={onListAttachmentEntries}
        onOpenThread={onOpenThread}
        onOpenSettingsView={onOpenSettingsView}
      />
    );
  }

  if (activeView === "settings") {
    return (
      <SettingsView
        appSettings={appSettings}
        piSettings={piSettings}
        piTheme={piTheme}
        availableModels={availableModels}
        availableThinkingLevels={availableThinkingLevels}
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
    <div className="relative grid h-full min-h-0 w-full justify-items-center overflow-hidden px-4 pb-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-4">
        <div className="pointer-events-auto mb-1.5 ml-3 min-w-0">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            data-tooltip={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            data-tooltip-placement="right"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>
      </div>
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
