import type { ProjectDiffBaseline, ProjectDiffRenderMode } from "../desktop/types";
import { CodeWorkspaceView } from "../features/code/CodeWorkspaceView";
import { mainPanelClass } from "../ui/classes";
import { MainView } from "../views/MainView";
import type { AppShellController } from "./useAppShellController";

type AppShellWorkspaceProps = {
  controller: AppShellController;
  activeComposerState: AppShellController["activeComposerState"];
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  currentProjectName: string;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: ProjectDiffRenderMode;
  terminalDrawerVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (renderMode: ProjectDiffRenderMode) => void;
};

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  currentProjectName,
  diffBaseline,
  diffRenderMode,
  terminalDrawerVisible,
  terminalSessionPath,
  workspaceContentClass,
  onSetDiffBaseline,
  onSetDiffRenderMode,
}: AppShellWorkspaceProps) {
  const { state } = controller;

  if (state.activeView === "chat" || state.activeView === "claw" || state.activeView === "work") {
    return (
      <div className="relative min-h-0 flex-1 px-5 pt-1.5">
        <main className={mainPanelClass}>
          <MainView activeView={state.activeView} />
        </main>
      </div>
    );
  }

  return (
    <CodeWorkspaceView
      controller={controller}
      activeComposerState={activeComposerState}
      activeThreadData={activeThreadData}
      composerProjectId={composerProjectId}
      currentProjectName={currentProjectName}
      diffBaseline={diffBaseline}
      diffRenderMode={diffRenderMode}
      terminalDrawerVisible={terminalDrawerVisible}
      terminalSessionPath={terminalSessionPath}
      workspaceContentClass={workspaceContentClass}
      onSetDiffBaseline={onSetDiffBaseline}
      onSetDiffRenderMode={onSetDiffRenderMode}
    />
  );
}
