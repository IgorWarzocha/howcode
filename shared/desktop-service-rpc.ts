import type {
  AppService,
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
}

export type DesktopServiceRemoteModuleName = keyof DesktopServiceRemoteRuntime

type MethodAllowlist<T> = { readonly [K in keyof T]-?: true }

export const desktopServiceRemoteMethods = {
  dev: { inspectActivity: true },
  packages: {
    installInstalledComponent: true,
    updateInstalledComponent: true,
    removeInstalledComponent: true,
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
  skills: {
    searchPiSkills: true,
    listConfiguredPiSkills: true,
    installPiSkill: true,
    removePiSkill: true,
  },
} as const satisfies {
  readonly [K in DesktopServiceRemoteModuleName]: MethodAllowlist<DesktopServiceRemoteRuntime[K]>
}
