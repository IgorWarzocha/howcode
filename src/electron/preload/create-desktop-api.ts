import { type IpcRendererEvent, ipcRenderer, webUtils } from 'electron'
import {
  type DesktopEventChannel,
  type DesktopEventMap,
  type DesktopRequestChannel,
  type DesktopRequestMap,
  getDesktopEventIpcChannel,
  getDesktopRequestIpcChannel,
} from '../../../shared/desktop-ipc'
import type { DesktopAction } from '../../app/desktop/actions'
import type {
  AnyDesktopActionPayload,
  DesktopEvent,
  TerminalEvent,
  TerminalOpenRequest,
} from '../../app/desktop/types'

function invokeRequest<K extends DesktopRequestChannel>(
  channel: K,
  params: DesktopRequestMap[K]['params'],
) {
  return ipcRenderer.invoke(getDesktopRequestIpcChannel(channel), params) as Promise<
    DesktopRequestMap[K]['response']
  >
}

function subscribeToEvent<K extends DesktopEventChannel>(
  channel: K,
  listener: (event: DesktopEventMap[K]) => void,
) {
  const ipcChannel = getDesktopEventIpcChannel(channel)
  const wrappedListener = (_event: IpcRendererEvent, payload: DesktopEventMap[K]) => {
    listener(payload)
  }

  ipcRenderer.on(ipcChannel, wrappedListener)
  return () => {
    ipcRenderer.removeListener(ipcChannel, wrappedListener)
  }
}

function createAppUpdateApi() {
  return {
    getAppUpdateState: () => invokeRequest('getAppUpdateState', {}),
    checkAppUpdate: () => invokeRequest('checkAppUpdate', {}),
    installAppUpdate: () => invokeRequest('installAppUpdate', {}),
    restartAppUpdate: () => invokeRequest('restartAppUpdate', {}),
  }
}

function createProjectApi() {
  return {
    getShellState: () => invokeRequest('getShellState', {}),
    getProjectGitState: (projectId: string) => invokeRequest('getProjectGitState', { projectId }),
    getProjectUsageSummary: (projectId: string) =>
      invokeRequest('getProjectUsageSummary', { projectId }),
    getProjectDiff: (projectId: string, baseline = null) =>
      invokeRequest('getProjectDiff', { projectId, baseline }),
    getProjectDiffStats: (projectId: string, baseline = null) =>
      invokeRequest('getProjectDiffStats', { projectId, baseline }),
    captureProjectDiffBaseline: (projectId: string) =>
      invokeRequest('captureProjectDiffBaseline', { projectId }),
    listProjectCommits: (projectId: string, limit: number | null = null) =>
      invokeRequest('listProjectCommits', { projectId, limit }),
    getProjectThreads: (projectId: string, request: { chat?: boolean } = {}) =>
      invokeRequest(
        'getProjectThreads',
        request.chat === undefined ? { projectId } : { projectId, chat: request.chat },
      ),
  }
}

function createPackageAndSkillApi() {
  return {
    searchPiPackages: (request = {}) => invokeRequest('searchPiPackages', request),
    getConfiguredPiPackages: (request = {}) => invokeRequest('getConfiguredPiPackages', request),
    installPiPackage: (request: {
      source: string
      kind?: 'npm' | 'git' | undefined
      local?: boolean
      projectPath?: string | null
      chat?: boolean
    }) => invokeRequest('installPiPackage', request),
    removePiPackage: (request: {
      source: string
      local?: boolean
      projectPath?: string | null
      chat?: boolean
    }) => invokeRequest('removePiPackage', request),
    searchPiSkills: (request = {}) => invokeRequest('searchPiSkills', request),
    getConfiguredPiSkills: (request = {}) => invokeRequest('getConfiguredPiSkills', request),
    installPiSkill: (request: {
      source: string
      local?: boolean
      projectPath?: string | null
      chat?: boolean
    }) => invokeRequest('installPiSkill', request),
    removePiSkill: (request: {
      installedPath: string
      projectPath?: string | null
      chat?: boolean
    }) => invokeRequest('removePiSkill', request),
  }
}

function createSkillCreatorApi() {
  return {
    startSkillCreatorSession: (request: {
      prompt: string
      local?: boolean
      projectPath?: string | null
      chat?: boolean
    }) => invokeRequest('startSkillCreatorSession', request),
    continueSkillCreatorSession: (request: { sessionId: string; prompt: string }) =>
      invokeRequest('continueSkillCreatorSession', request),
    closeSkillCreatorSession: (sessionId: string) =>
      invokeRequest('closeSkillCreatorSession', { sessionId }),
  }
}

function createComposerAndClipboardApi() {
  return {
    clearClipboardImages: () => invokeRequest('clearClipboardImages', {}),
    pickComposerAttachments: (projectId: string | null = null) =>
      invokeRequest('pickComposerAttachments', { projectId }),
    listProjectDirectoryEntries: (request = {}) =>
      invokeRequest('listProjectDirectoryEntries', request),
    readClipboardSnapshot: (formats: string[] | null = null) =>
      invokeRequest('readClipboardSnapshot', { formats }),
    readClipboardFilePaths: () => invokeRequest('readClipboardFilePaths', {}),
    readClipboardImage: () => invokeRequest('readClipboardImage', {}),
    getAttachmentKindsForPaths: (paths: string[]) =>
      invokeRequest('getAttachmentKindsForPaths', { paths }),
    getPathForFile: (file: File) => {
      try {
        return webUtils.getPathForFile(file) || null
      } catch {
        return null
      }
    },
    listComposerAttachmentEntries: (request = {}) =>
      invokeRequest('listComposerAttachmentEntries', request),
    searchComposerAttachmentEntries: (request = {}) =>
      invokeRequest('searchComposerAttachmentEntries', request),
    getComposerState: (request = {}) => invokeRequest('getComposerState', request),
    getComposerSlashCommands: (request = {}) => invokeRequest('getComposerSlashCommands', request),
    getComposerSkills: (request = {}) => invokeRequest('getComposerSkills', request),
  }
}

function createDictationApi() {
  return {
    getDictationState: () => invokeRequest('getDictationState', {}),
    listDictationModels: () => invokeRequest('listDictationModels', {}),
    installDictationModel: (modelId: 'tiny.en' | 'base.en' | 'small.en') =>
      invokeRequest('installDictationModel', { modelId }),
    removeDictationModel: (modelId: 'tiny.en' | 'base.en' | 'small.en') =>
      invokeRequest('removeDictationModel', { modelId }),
    transcribeDictation: (request: {
      audioBase64: string
      sampleRate: number
      language?: string | null
    }) => invokeRequest('transcribeDictation', request),
  }
}

function createArtifactAndThreadApi() {
  return {
    getChatSidebarState: (selectedGroupId: string | null = null) =>
      invokeRequest('getChatSidebarState', { selectedGroupId }),
    createChatGroup: (name: string) => invokeRequest('createChatGroup', { name }),
    listArtifacts: (conversationId: string | null = null) =>
      invokeRequest('listArtifacts', { conversationId }),
    getArtifact: (artifactSlug: string, conversationId: string | null = null) =>
      invokeRequest('getArtifact', { artifactSlug, conversationId }),
    updateArtifact: (artifactSlug: string, content: string, conversationId: string | null = null) =>
      invokeRequest('updateArtifact', { artifactSlug, content, conversationId }),
    editArtifact: (
      artifactSlug: string,
      edits: Array<{ oldText: string; newText: string }>,
      conversationId: string | null = null,
    ) => invokeRequest('editArtifact', { artifactSlug, edits, conversationId }),
    listArtifactVersions: (artifactSlug: string) =>
      invokeRequest('listArtifactVersions', { artifactSlug }),
    compileReactArtifact: (source: string) => invokeRequest('compileReactArtifact', { source }),
    getInboxThreads: () => invokeRequest('getInboxThreads', {}),
    getArchivedThreads: () => invokeRequest('getArchivedThreads', {}),
    getThread: (sessionPath: string, historyCompactions = 0) =>
      invokeRequest('getThread', { sessionPath, historyCompactions }),
    searchThread: (sessionPath: string, query: string) =>
      invokeRequest('searchThread', { sessionPath, query }),
    watchSession: async (sessionPath: string | null) => {
      await invokeRequest('watchSession', { sessionPath })
    },
  }
}

function createTerminalAndSystemApi() {
  return {
    invokeAction: (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
      invokeRequest('invokeAction', { action, payload }),
    listTerminals: () => invokeRequest('listTerminals', {}),
    openTerminal: (request: TerminalOpenRequest) => invokeRequest('terminalOpen', request),
    writeTerminal: async (sessionId: string, data: string) => {
      await invokeRequest('terminalWrite', { sessionId, data })
    },
    resizeTerminal: async (request: { sessionId: string; cols: number; rows: number }) => {
      await invokeRequest('terminalResize', request)
    },
    closeTerminal: async (request: { sessionId: string; deleteHistory?: boolean }) => {
      await invokeRequest('terminalClose', request)
    },
    statTerminalSessionFile: (sessionId: string) =>
      invokeRequest('terminalSessionFileStat', { sessionId }),
    getTerminalStatus: (sessionId: string) => invokeRequest('terminalStatus', { sessionId }),
    openExternal: (url: string) => invokeRequest('openExternal', { url }).then(({ ok }) => ok),
    openPath: (path: string) => invokeRequest('openPath', { path }).then(({ ok }) => ok),
    saveTextToDownloads: (fileName: string, content: string) =>
      invokeRequest('saveTextToDownloads', { fileName, content }),
    subscribe: (listener: (event: DesktopEvent) => void) =>
      subscribeToEvent('desktopEvent', listener),
    subscribeTerminal: (listener: (event: TerminalEvent) => void) =>
      subscribeToEvent('terminalEvent', listener),
  }
}

export function createDesktopApi() {
  return {
    platform: process.platform,
    ...createAppUpdateApi(),
    ...createProjectApi(),
    ...createPackageAndSkillApi(),
    ...createSkillCreatorApi(),
    ...createComposerAndClipboardApi(),
    ...createDictationApi(),
    ...createArtifactAndThreadApi(),
    ...createTerminalAndSystemApi(),
  }
}
