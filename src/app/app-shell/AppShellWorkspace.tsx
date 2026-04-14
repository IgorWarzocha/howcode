import type { ComposerSurface } from "../components/workspace/Composer";
import type { ProjectDiffBaseline } from "../desktop/types";
import { CodeWorkspaceView } from "../features/code/CodeWorkspaceView";
import { mainPanelClass } from "../ui/classes";
import { MainView } from "../views/MainView";
import type { AppShellController } from "./useAppShellController";

type AppShellWorkspaceProps = {
  controller: AppShellController;
  activeComposerState: AppShellController["activeComposerState"];
  activeThreadData: AppShellController["activeThreadData"];
  composerProjectId: string;
  composerSurface: ComposerSurface;
  currentProjectName: string;
  diffBaseline: ProjectDiffBaseline;
  dockedTerminalVisible: boolean;
  terminalSessionPath: string | null;
  workspaceContentClass: string;
  onSetComposerSurface: (surface: ComposerSurface) => void;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
};

export function AppShellWorkspace({
  controller,
  activeComposerState,
  activeThreadData,
  composerProjectId,
  composerSurface,
  currentProjectName,
  diffBaseline,
  dockedTerminalVisible,
  terminalSessionPath,
  workspaceContentClass,
  onSetComposerSurface,
  onSetDiffBaseline,
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
      composerSurface={composerSurface}
      currentProjectName={currentProjectName}
      diffBaseline={diffBaseline}
      dockedTerminalVisible={dockedTerminalVisible}
      terminalSessionPath={terminalSessionPath}
      workspaceContentClass={workspaceContentClass}
      onSetComposerSurface={onSetComposerSurface}
      onSetDiffBaseline={onSetDiffBaseline}
    />
  );
}
