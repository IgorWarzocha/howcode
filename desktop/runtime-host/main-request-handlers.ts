import { loadAppSettings } from '../app-settings/readers.ts'
import {
  createArtifact,
  editArtifact,
  getArtifact,
  listArtifacts,
  updateArtifact,
} from '../artifact-state-db.ts'
import { getSessionNativeExtensions, setSessionNativeExtensions } from '../thread-state-db.ts'
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

const runtimeHostMainRequestHandlers = {
  createArtifact: (payload) => createArtifact(payload),
  editArtifact: (payload) => editArtifact(payload),
  getArtifact: (payload) => getArtifact(payload.artifactSlug, payload.conversationId),
  getSessionNativeExtensions: (payload) => getSessionNativeExtensions(payload.sessionPath),
  listArtifacts: (payload) => listArtifacts(payload.conversationId),
  setSessionNativeExtensions: (payload) => {
    setSessionNativeExtensions(payload.sessionPath, payload.enabled)
    return { ok: true }
  },
  snapshotDefaultNativeExtensions: () =>
    loadAppSettings().howcodeNativeAskQuestions ? ['askQuestions'] : [],
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
