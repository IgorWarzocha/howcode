import type {
  AppService,
  ArtifactsService,
  DictationService,
  PiSkillsService,
  PluginService,
  WorkingDirectoriesService,
} from './desktop-service-contracts'
import type { DevRuntimeService } from './dev-runtime'
import type { PackageUiService } from './package-ui-contracts'

export type DesktopServiceRemoteRuntime = {
  dev: DevRuntimeService
  packages: PackageUiService
  app: Omit<AppService, 'disposeDesktopRuntime' | 'subscribeDesktopEvents'>
  skills: PiSkillsService
  plugins: PluginService
  workingDirectories: WorkingDirectoriesService
  artifacts: ArtifactsService
  dictation: DictationService
}

export type DesktopServiceRemoteModuleName = keyof DesktopServiceRemoteRuntime

type MethodAllowlist<T> = { readonly [K in keyof T]-?: true }

export const desktopServiceRemoteMethods = {
  dev: { inspectActivity: true },
  packages: {
    listInstalledComponents: true,
    admitInstalledComponent: true,
    loadInstalledComponent: true,
    listPackageUis: true,
    loadPackageUi: true,
    openPackageUiBinding: true,
    readPackageUiBindingEvents: true,
    operatePackageUiBinding: true,
    closePackageUiBinding: true,
  },
  app: {
    workspaceLayout: true,
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
  plugins: { request: true, hostRequest: true },
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
