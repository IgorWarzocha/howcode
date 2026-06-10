import { loadAppSettings } from '../app-settings/readers.ts'
import {
  createArtifact,
  editArtifact,
  getArtifact,
  listArtifacts,
  updateArtifact,
} from '../artifact-state-db.ts'
import type {
  RuntimeHostMainRequestMap,
  RuntimeHostMainRequestMessage,
  RuntimeHostMainRequestName,
  RuntimeHostMainResponseMap,
} from './protocol.ts'

type RuntimeHostMainRequestHandlerMap = {
  [TName in RuntimeHostMainRequestName]: (
    payload: RuntimeHostMainRequestMap[TName],
  ) => RuntimeHostMainResponseMap[TName]
}

function getNativeSmartBtwConfig() {
  const settings = loadAppSettings()
  const selection = settings.smartBtwModel
  const composerSelection = settings.codeModel ?? settings.chatModel
  return {
    model: selection ? `${selection.provider}/${selection.id}` : null,
    composerModel: composerSelection
      ? `${composerSelection.provider}/${composerSelection.id}`
      : null,
    thinking: settings.smartBtwThinkingLevel,
  }
}

const runtimeHostMainRequestHandlers = {
  createArtifact: (payload) => createArtifact(payload),
  editArtifact: (payload) => editArtifact(payload),
  getArtifact: (payload) => getArtifact(payload.artifactSlug, payload.conversationId),
  getNativeSmartBtwConfig: () => getNativeSmartBtwConfig(),
  listArtifacts: (payload) => listArtifacts(payload.conversationId),

  updateArtifact: (payload) => updateArtifact(payload),
} satisfies RuntimeHostMainRequestHandlerMap

export function handleRuntimeHostMainRequest<TName extends RuntimeHostMainRequestName>(
  message: RuntimeHostMainRequestMessage<TName>,
): RuntimeHostMainResponseMap[TName] {
  const handler = runtimeHostMainRequestHandlers[message.name] as unknown as (
    payload: RuntimeHostMainRequestMap[TName],
  ) => RuntimeHostMainResponseMap[TName]
  return handler(message.payload)
}
