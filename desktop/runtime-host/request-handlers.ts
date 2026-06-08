import {
  answerNativeExtensionDialog,
  closeSkillCreatorSession,
  continueSkillCreatorSession,
  dequeueComposerPrompt,
  disposeRuntimeHosts,
  generateGitCommitMessage,
  getComposerSkills,
  getComposerSlashCommands,
  getComposerState,
  getPiSessionStorage,
  installPiPackage,
  installPiSkill,
  invalidateRuntimeSettings,
  invokeNativeExtensionShortcut,
  listConfiguredPiPackages,
  listConfiguredPiSkills,
  loadPiSettings,
  loadPiThemeState,
  loadThreadSnapshot,
  openThreadRuntime,
  removePiPackage,
  removePiSkill,
  searchThreadSnapshot,
  selectProjectRuntime,
  sendComposerPrompt,
  setComposerModel,
  setComposerThinkingLevel,
  setProjectTrust,
  startNewThread,
  startSkillCreatorSession,
  stopComposerRun,
  updatePiSetting,
} from './host-service.ts'
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestMessage,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
} from './protocol.ts'

type RuntimeHostRequestHandlerMap = {
  [TName in RuntimeHostRequestName]: (
    payload: RuntimeHostRequestMap[TName],
  ) => Promise<RuntimeHostResponseMap[TName]> | RuntimeHostResponseMap[TName]
}

const runtimeHostRequestHandlers = {
  answerNativeExtensionDialog: (payload) => answerNativeExtensionDialog(payload),
  closeSkillCreatorSession: (payload) => closeSkillCreatorSession(payload),
  continueSkillCreatorSession: (payload) => continueSkillCreatorSession(payload),
  dequeueComposerPrompt: (payload) => dequeueComposerPrompt(payload),
  disposeRuntimeHosts: (payload) => disposeRuntimeHosts(payload),
  generateGitCommitMessage: (payload) => generateGitCommitMessage(payload.request, payload.context),
  getComposerSkills: (payload) => getComposerSkills(payload.request),
  getComposerSlashCommands: (payload) => getComposerSlashCommands(payload.request),
  getComposerState: (payload) => getComposerState(payload.request),
  invokeNativeExtensionShortcut: (payload) => invokeNativeExtensionShortcut(payload),
  getPiSessionStorage: (payload) => getPiSessionStorage(payload.projectPath),
  installPiPackage: (payload) => installPiPackage(payload),
  installPiSkill: (payload) => installPiSkill(payload),
  invalidateRuntimeSettings: (payload) => invalidateRuntimeSettings(payload),
  listConfiguredPiPackages: (payload) => listConfiguredPiPackages(payload),
  listConfiguredPiSkills: (payload) => listConfiguredPiSkills(payload),
  loadPiSettings: (payload) => loadPiSettings(payload.projectPath),
  loadPiThemeState: (payload) => loadPiThemeState(payload.projectPath),
  loadThreadSnapshot: (payload) => loadThreadSnapshot(payload),
  openThreadRuntime: (payload) => openThreadRuntime(payload.request),
  removePiPackage: (payload) => removePiPackage(payload),
  removePiSkill: (payload) => removePiSkill(payload),
  searchThreadSnapshot: (payload) => searchThreadSnapshot(payload),
  selectProjectRuntime: (payload) => selectProjectRuntime(payload.request),
  sendComposerPrompt: (payload) => sendComposerPrompt(payload),
  setComposerModel: (payload) =>
    setComposerModel(payload.request, payload.provider, payload.modelId),
  setProjectTrust: (payload) => setProjectTrust(payload),
  setComposerThinkingLevel: (payload) => setComposerThinkingLevel(payload.request, payload.level),
  startNewThread: (payload) => startNewThread(payload.request),
  startSkillCreatorSession: (payload) => startSkillCreatorSession(payload),
  stopComposerRun: (payload) => stopComposerRun(payload.request),
  updatePiSetting: (payload) => updatePiSetting(payload.key, payload.value, payload.projectPath),
} satisfies RuntimeHostRequestHandlerMap

export async function handleRuntimeHostRequest<TName extends RuntimeHostRequestName>(
  message: RuntimeHostRequestMessage<TName>,
): Promise<RuntimeHostResponseMap[TName]> {
  const handler = runtimeHostRequestHandlers[message.name] as unknown as (
    payload: RuntimeHostRequestMap[TName],
  ) => Promise<RuntimeHostResponseMap[TName]> | RuntimeHostResponseMap[TName]
  return await handler(message.payload)
}
