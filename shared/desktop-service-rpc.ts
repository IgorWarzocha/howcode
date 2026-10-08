import type {
  AppService,
  ArtifactsService,
  DictationService,
  GitService,
  PiSkillsService,
  WorkingDirectoriesService,
} from './desktop-service-contracts'
import type { PackageUiService } from './package-ui-contracts'

export type DesktopServiceRemoteRuntime = {
  packages: PackageUiService
  app: Omit<AppService, 'disposeDesktopRuntime' | 'subscribeDesktopEvents'>
  skills: PiSkillsService
  git: GitService
  workingDirectories: WorkingDirectoriesService
  artifacts: ArtifactsService
  dictation: DictationService
}

export type DesktopServiceRemoteModuleName = keyof DesktopServiceRemoteRuntime

type MethodAllowlist<T> = { readonly [K in keyof T]-?: true }

export const desktopServiceRemoteMethods = {
  packages: {
    listPackageUis: true,
    loadPackageUi: true,
    invokePackageUiRpc: true,
  },
  app: {
    handleDesktopAction: true,
    loadArchivedChatList: true,
    loadInboxChatList: true,
    loadComposerState: true,
    loadComposerSlashCommands: true,
    loadComposerSkills: true,
    loadDirectoryChats: true,
    loadWorkspaceNavigationState: true,
    createWorkspace: true,
    loadShellState: true,
    loadAppSettings: true,
    loadConversationEntries: true,
    loadChatPreviewAtEntry: true,
    loadChat: true,
    searchChat: true,
    watchConversation: true,
  },
  workingDirectories: {
    loadDirectoryUsageSummary: true,
    loadDirectoryFavicon: true,
  },
  git: {
    loadDirectoryGitState: true,
    startDirectoryDiffStream: true,
    cancelDirectoryDiffStream: true,
    loadDirectoryDiffStats: true,
    loadDirectoryDiffImagePreview: true,
    loadDirectoryDiffFileContents: true,
    captureDirectoryDiffBaseline: true,
    listDirectoryCommits: true,
  },
  artifacts: {
    listArtifacts: true,
    getArtifact: true,
    updateArtifact: true,
    editArtifact: true,
    listArtifactVersions: true,
    compileReactArtifact: true,
  },
  dictation: {
    getDictationState: true,
    listDictationModels: true,
    installDictationModel: true,
    removeDictationModel: true,
    transcribeDictation: true,
  },
  skills: {
    searchPiSkills: true,
    listConfiguredPiSkills: true,
    installPiSkill: true,
    removePiSkill: true,
  },
} as const satisfies {
  readonly [K in DesktopServiceRemoteModuleName]: MethodAllowlist<DesktopServiceRemoteRuntime[K]>
}
