import type { PiSkillsService, PiThreadsService } from './desktop-service-contracts'

export type DesktopServiceRemoteRuntime = {
  piThreads: Omit<PiThreadsService, 'disposeDesktopRuntime' | 'subscribeDesktopEvents'>
  piSkills: PiSkillsService
}

export type DesktopServiceRemoteModuleName = keyof DesktopServiceRemoteRuntime

type MethodAllowlist<T> = { readonly [K in keyof T]-?: true }

export const desktopServiceRemoteMethods = {
  piThreads: {
    handleDesktopAction: true,
    loadArchivedThreadList: true,
    loadInboxThreadList: true,
    loadComposerState: true,
    loadComposerSlashCommands: true,
    loadComposerSkills: true,
    getDictationState: true,
    listDictationModels: true,
    installDictationModel: true,
    removeDictationModel: true,
    transcribeDictation: true,
    searchPiPackages: true,
    listConfiguredPiPackages: true,
    installPiPackage: true,
    removePiPackage: true,
    loadProjectGitState: true,
    loadProjectUsageSummary: true,
    loadProjectFavicon: true,
    startProjectDiffStream: true,
    cancelProjectDiffStream: true,
    loadProjectDiffStats: true,
    loadProjectDiffImagePreview: true,
    loadProjectDiffFileContents: true,
    captureProjectDiffBaseline: true,
    listProjectCommits: true,
    loadProjectThreads: true,
    loadChatSidebarState: true,
    createChatGroup: true,
    listArtifacts: true,
    getArtifact: true,
    updateArtifact: true,
    editArtifact: true,
    listArtifactVersions: true,
    compileReactArtifact: true,
    loadShellState: true,
    loadAppSettings: true,
    loadSessionTreeList: true,
    loadThreadPreviewAtEntry: true,
    loadThread: true,
    searchThread: true,
    setWatchedSessionPath: true,
  },
  piSkills: {
    searchPiSkills: true,
    listConfiguredPiSkills: true,
    installPiSkill: true,
    removePiSkill: true,
  },
} as const satisfies {
  readonly piThreads: MethodAllowlist<DesktopServiceRemoteRuntime['piThreads']>
  readonly piSkills: MethodAllowlist<DesktopServiceRemoteRuntime['piSkills']>
}
