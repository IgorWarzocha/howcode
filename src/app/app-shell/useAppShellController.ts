import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import { getPersistedSessionPath } from "../../../shared/session-paths";
import type { ArchivedThread, ComposerState, ProjectGitState, ThreadData } from "../desktop/types";
import { useDesktopBridge } from "../hooks/useDesktopBridge";
import { useDesktopInbox } from "../hooks/useDesktopInbox";
import { useDesktopShell } from "../hooks/useDesktopShell";
import { useDesktopThread } from "../hooks/useDesktopThread";
import { useToast } from "../hooks/useToast";
import { createInitialWorkspaceState, workspaceReducer } from "../state/workspace";
import { deriveControllerViewModel } from "./controller-view-model";
import { useAppShellCommands } from "./useAppShellCommands";
import { useAppShellEffects } from "./useAppShellEffects";
import { useDesktopActionHandlers } from "./useDesktopActionHandlers";
import { useInboxAutoReadSync } from "./useInboxAutoReadSync";
import { useProjectRepoOriginRefresh } from "./useProjectRepoOriginRefresh";
import { useRunningTerminalSessions } from "./useRunningTerminalSessions";
import { useScopedProjectViewSync } from "./useScopedProjectViewSync";

export function useAppShellController() {
  const queryClient = useQueryClient();
  const [appLaunchedAtMs] = useState(() => Date.now());
  const [state, dispatch] = useReducer(workspaceReducer, [], createInitialWorkspaceState);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [liveThreadData, setLiveThreadData] = useState<ThreadData | null>(null);
  const [projectGitState, setProjectGitState] = useState<ProjectGitState | null>(null);
  const [extensionsProjectScopeActive, setExtensionsProjectScopeActive] = useState(false);
  const [skillsProjectScopeActive, setSkillsProjectScopeActive] = useState(false);
  const [threadRefreshKey, setThreadRefreshKey] = useState(0);
  const [threadHistoryCompactions, setThreadHistoryCompactions] = useState(0);
  const { toast, showToast } = useToast();
  const {
    shellState,
    loadArchivedThreads,
    loadComposerState,
    listComposerAttachmentEntries,
    loadProjectGitState,
    loadProjectThreads,
    applyProjectOrder,
    pickComposerAttachments,
    refreshShellState,
    scheduleShellStateRefresh,
  } = useDesktopShell();
  const invokeDesktopAction = useDesktopBridge();
  const shellProjects = shellState?.projects ?? [];
  const projects = useMemo(() => {
    const shellCwd = shellState?.cwd ?? null;

    if (!shellCwd || shellProjects.length <= 1) {
      return shellProjects;
    }

    return shellProjects.filter((project) => project.id !== shellCwd);
  }, [shellProjects, shellState?.cwd]);
  const threadData = useDesktopThread(
    state.selectedSessionPath,
    threadRefreshKey,
    threadHistoryCompactions,
  );
  const selectedPersistedSessionPath = getPersistedSessionPath(state.selectedSessionPath);
  const effectiveThreadData =
    threadHistoryCompactions === 0 && liveThreadData?.sessionPath === selectedPersistedSessionPath
      ? liveThreadData
      : threadData;
  const inboxQuery = useDesktopInbox();
  const inboxThreads = inboxQuery.data ?? [];
  const selectedInboxThread = useMemo(
    () =>
      inboxThreads.find((thread) => thread.sessionPath === state.selectedInboxSessionPath) ?? null,
    [inboxThreads, state.selectedInboxSessionPath],
  );
  const { terminalRunningProjectIds, terminalRunningSessionPaths } = useRunningTerminalSessions();

  const {
    activeComposerState,
    activeThreadData,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
  } = useMemo(
    () =>
      deriveControllerViewModel({
        projects,
        workspaceState: state,
        threadData: effectiveThreadData,
        shellCwd: shellState?.cwd,
        composerState,
        shellComposerState: shellState?.composer,
      }),
    [composerState, effectiveThreadData, projects, shellState?.composer, shellState?.cwd, state],
  );

  useAppShellEffects({
    projects,
    collapsedProjectIds,
    workspaceState: state,
    selectedInboxThread,
    composerProjectId,
    shellComposerState: shellState?.composer,
    shellAppSettings: shellState?.appSettings,
    loadProjectThreads,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    scheduleShellStateRefresh,
    queryClient,
    dispatch,
    setArchivedThreads,
    setComposerState,
    setLiveThreadData,
    setProjectGitState,
    setThreadHistoryCompactions,
  });

  const { handleAction, runDesktopAction } = useDesktopActionHandlers({
    activeView: state.activeView,
    composerProjectId,
    dispatch,
    invokeDesktopAction,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    loadProjectThreads,
    refreshShellState,
    selectedSessionPath: state.selectedSessionPath,
    setArchivedThreads,
    setComposerState,
    setProjectGitState,
    showToast,
    workspaceState: state,
  });

  useProjectRepoOriginRefresh({
    projects,
    selectedProjectId: state.selectedProjectId,
    runDesktopAction,
  });

  useScopedProjectViewSync({
    activeView: state.activeView,
    extensionsProjectScopeActive,
    setExtensionsProjectScopeActive,
    setSkillsProjectScopeActive,
    skillsProjectScopeActive,
  });

  useInboxAutoReadSync({
    dispatch,
    inboxQueryIsSuccess: inboxQuery.isSuccess,
    inboxThreads,
    invokeDesktopAction,
    loadProjectThreads,
    queryClient,
    workspaceState: state,
  });

  const commands = useAppShellCommands({
    applyProjectOrder,
    collapsedProjectIds,
    composerProjectId,
    dispatch,
    handleAction,
    queryClient,
    runDesktopAction,
    scheduleShellStateRefresh,
    setThreadHistoryCompactions,
    setThreadRefreshKey,
    shellState,
    workspaceState: state,
  });

  return {
    activeComposerState,
    activeThreadData,
    archivedThreads,
    collapsedProjectIds,
    composerProjectId,
    currentProjectName,
    currentTitle,
    handleAction,
    ...commands,
    inboxThreads,
    handleSetSkillsProjectScopeActive: setSkillsProjectScopeActive,
    handleSetExtensionsProjectScopeActive: setExtensionsProjectScopeActive,
    handleLoadProjectThreads: loadProjectThreads,
    listComposerAttachmentEntries,
    pickComposerAttachments,
    extensionsProjectScopeActive,
    appLaunchedAtMs,
    projects,
    projectGitState,
    shellState,
    skillsProjectScopeActive,
    state,
    selectedInboxThread,
    terminalRunningProjectIds,
    terminalRunningSessionPaths,
    toast,
  };
}

export type AppShellController = ReturnType<typeof useAppShellController>;
