import type { AppTransport } from '../../../shared/app-transport'
import type { DesktopAction } from '../../../shared/desktop-actions'
import type { AnyDesktopActionPayload, DesktopEvent } from '../../../shared/desktop-contracts'
import type { DesktopRequestMap } from '../../../shared/desktop-ipc'
import type { TerminalEvent, TerminalOpenRequest } from '../../../shared/terminal-contracts'

export function createDesktopApiFromTransport(
  transport: AppTransport,
  options: {
    getPathForFile?: (file: File) => string | null
  } = {},
) {
  const request = transport.request

  return {
    getAppUpdateState: () => request('getAppUpdateState', {}),
    checkAppUpdate: () => request('checkAppUpdate', {}),
    installAppUpdate: () => request('installAppUpdate', {}),
    restartAppUpdate: () => request('restartAppUpdate', {}),
    clearClipboardImages: () => request('clearClipboardImages', {}),
    getHowcodeServerState: () => request('getHowcodeServerState', {}),
    refreshHowcodeServerState: () => request('refreshHowcodeServerState', {}),
    listHowcodeRemoteEnvironments: () => request('listHowcodeRemoteEnvironments', {}),
    saveHowcodeRemoteEnvironment: (
      environment: DesktopRequestMap['saveHowcodeRemoteEnvironment']['params'],
    ) => request('saveHowcodeRemoteEnvironment', environment),
    deleteHowcodeRemoteEnvironment: (id: string) =>
      request('deleteHowcodeRemoteEnvironment', { id }),
    testHowcodeRemoteEnvironment: (id: string) => request('testHowcodeRemoteEnvironment', { id }),
    setActiveHowcodeRemoteEnvironment: (id: string) =>
      request('setActiveHowcodeRemoteEnvironment', { id }),
    clearActiveHowcodeRemoteEnvironment: () => request('clearActiveHowcodeRemoteEnvironment', {}),
    getProjectRemoteEnvironmentAssignment: (projectId: string) =>
      request('getProjectRemoteEnvironmentAssignment', { projectId }),
    setProjectRemoteEnvironmentAssignment: (
      projectId: string,
      remoteEnvironmentId: string | null,
    ) => request('setProjectRemoteEnvironmentAssignment', { projectId, remoteEnvironmentId }),
    getShellState: () => request('getShellState', {}),
    getProjectGitState: (projectId: string) => request('getProjectGitState', { projectId }),
    getProjectDiff: (
      projectId: string,
      baseline: DesktopRequestMap['getProjectDiff']['params']['baseline'] = null,
    ) => request('getProjectDiff', { projectId, baseline }),
    getProjectDiffStats: (
      projectId: string,
      baseline: DesktopRequestMap['getProjectDiffStats']['params']['baseline'] = null,
    ) => request('getProjectDiffStats', { projectId, baseline }),
    captureProjectDiffBaseline: (projectId: string) =>
      request('captureProjectDiffBaseline', { projectId }),
    listProjectCommits: (projectId: string, limit: number | null = null) =>
      request('listProjectCommits', { projectId, limit }),
    searchPiPackages: (searchRequest = {}) => request('searchPiPackages', searchRequest),
    getConfiguredPiPackages: (packagesRequest = {}) =>
      request('getConfiguredPiPackages', packagesRequest),
    installPiPackage: (installRequest: DesktopRequestMap['installPiPackage']['params']) =>
      request('installPiPackage', installRequest),
    removePiPackage: (removeRequest: DesktopRequestMap['removePiPackage']['params']) =>
      request('removePiPackage', removeRequest),
    searchPiSkills: (searchRequest = {}) => request('searchPiSkills', searchRequest),
    getConfiguredPiSkills: (skillsRequest = {}) => request('getConfiguredPiSkills', skillsRequest),
    installPiSkill: (installRequest: DesktopRequestMap['installPiSkill']['params']) =>
      request('installPiSkill', installRequest),
    removePiSkill: (removeRequest: DesktopRequestMap['removePiSkill']['params']) =>
      request('removePiSkill', removeRequest),
    startSkillCreatorSession: (
      sessionRequest: DesktopRequestMap['startSkillCreatorSession']['params'],
    ) => request('startSkillCreatorSession', sessionRequest),
    continueSkillCreatorSession: (
      sessionRequest: DesktopRequestMap['continueSkillCreatorSession']['params'],
    ) => request('continueSkillCreatorSession', sessionRequest),
    closeSkillCreatorSession: (sessionId: string) =>
      request('closeSkillCreatorSession', { sessionId }),
    pickComposerAttachments: (projectId: string | null = null) =>
      request('pickComposerAttachments', { projectId }),
    readClipboardSnapshot: (formats: string[] | null = null) =>
      request('readClipboardSnapshot', { formats }),
    readClipboardFilePaths: () => request('readClipboardFilePaths', {}),
    readClipboardImage: () => request('readClipboardImage', {}),
    getAttachmentKindsForPaths: (paths: string[]) =>
      request('getAttachmentKindsForPaths', { paths }),
    getPathForFile: (file: File) => options.getPathForFile?.(file) ?? null,
    listComposerAttachmentEntries: (entriesRequest = {}) =>
      request('listComposerAttachmentEntries', entriesRequest),
    searchComposerAttachmentEntries: (entriesRequest = {}) =>
      request('searchComposerAttachmentEntries', entriesRequest),
    getComposerState: (stateRequest = {}) => request('getComposerState', stateRequest),
    getComposerSlashCommands: (commandsRequest = {}) =>
      request('getComposerSlashCommands', commandsRequest),
    getComposerSkills: (skillsRequest = {}) => request('getComposerSkills', skillsRequest),
    getDictationState: () => request('getDictationState', {}),
    listDictationModels: () => request('listDictationModels', {}),
    installDictationModel: (
      modelId: DesktopRequestMap['installDictationModel']['params']['modelId'],
    ) => request('installDictationModel', { modelId }),
    removeDictationModel: (
      modelId: DesktopRequestMap['removeDictationModel']['params']['modelId'],
    ) => request('removeDictationModel', { modelId }),
    transcribeDictation: (dictationRequest: DesktopRequestMap['transcribeDictation']['params']) =>
      request('transcribeDictation', dictationRequest),
    getProjectThreads: (projectId: string, threadsRequest: { chat?: boolean | undefined } = {}) =>
      request(
        'getProjectThreads',
        threadsRequest.chat === undefined
          ? { projectId }
          : { projectId, chat: threadsRequest.chat },
      ),
    getChatSidebarState: (selectedGroupId: string | null = null) =>
      request('getChatSidebarState', { selectedGroupId }),
    createChatGroup: (name: string) => request('createChatGroup', { name }),
    listArtifacts: (conversationId: string | null = null) =>
      request('listArtifacts', { conversationId }),
    getArtifact: (artifactSlug: string, conversationId: string | null = null) =>
      request('getArtifact', { artifactSlug, conversationId }),
    updateArtifact: (artifactSlug: string, content: string, conversationId: string | null = null) =>
      request('updateArtifact', { artifactSlug, content, conversationId }),
    editArtifact: (
      artifactSlug: string,
      edits: Array<{ oldText: string; newText: string }>,
      conversationId: string | null = null,
    ) => request('editArtifact', { artifactSlug, edits, conversationId }),
    listArtifactVersions: (artifactSlug: string) =>
      request('listArtifactVersions', { artifactSlug }),
    compileReactArtifact: (source: string) => request('compileReactArtifact', { source }),
    getInboxThreads: () => request('getInboxThreads', {}),
    getArchivedThreads: () => request('getArchivedThreads', {}),
    getThread: (sessionPath: string, historyCompactions = 0) =>
      request('getThread', { sessionPath, historyCompactions }),
    watchSession: async (sessionPath: string | null) => {
      await request('watchSession', { sessionPath })
    },
    invokeAction: (action: DesktopAction, payload: AnyDesktopActionPayload = {}) =>
      request('invokeAction', { action, payload }),
    listTerminals: () => request('listTerminals', {}),
    openTerminal: (terminalRequest: TerminalOpenRequest) =>
      request('terminalOpen', terminalRequest),
    writeTerminal: async (sessionId: string, data: string) => {
      await request('terminalWrite', { sessionId, data })
    },
    resizeTerminal: async (resizeRequest: DesktopRequestMap['terminalResize']['params']) => {
      await request('terminalResize', resizeRequest)
    },
    closeTerminal: async (closeRequest: DesktopRequestMap['terminalClose']['params']) => {
      await request('terminalClose', closeRequest)
    },
    statTerminalSessionFile: (sessionId: string) =>
      request('terminalSessionFileStat', { sessionId }),
    getTerminalStatus: (sessionId: string) => request('terminalStatus', { sessionId }),
    openExternal: (url: string) => request('openExternal', { url }).then(({ ok }) => ok),
    openPath: (path: string) => request('openPath', { path }).then(({ ok }) => ok),
    saveTextToDownloads: (fileName: string, content: string) =>
      request('saveTextToDownloads', { fileName, content }),
    subscribe: (listener: (event: DesktopEvent) => void) =>
      transport.subscribe('desktopEvent', listener),
    subscribeTerminal: (listener: (event: TerminalEvent) => void) =>
      transport.subscribe('terminalEvent', listener),
  }
}
