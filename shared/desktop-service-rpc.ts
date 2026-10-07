import type {
  AppService,
  ArtifactsService,
  CodingService,
  DictationService,
  PiSkillsService,
} from './desktop-service-contracts'
import type { PackageUiService } from './package-ui-contracts'

export type DesktopServiceRemoteRuntime = {
  packages: PackageUiService
  app: Omit<AppService, 'disposeDesktopRuntime' | 'subscribeDesktopEvents'>
  skills: PiSkillsService
  coding: CodingService
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
    loadArchivedThreadList: true,
    loadInboxThreadList: true,
    loadComposerState: true,
    loadComposerSlashCommands: true,
    loadComposerSkills: true,
    loadProjectThreads: true,
    loadChatSidebarState: true,
    createChatGroup: true,
    loadShellState: true,
    loadAppSettings: true,
    loadConversationEntries: true,
    loadThreadPreviewAtEntry: true,
    loadThread: true,
    searchThread: true,
    watchConversation: true,
  },
  coding: {
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
