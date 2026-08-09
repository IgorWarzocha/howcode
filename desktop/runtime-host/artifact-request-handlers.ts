import { createArtifact, editArtifact, getArtifact, listArtifacts } from '../artifact-state-db.ts'
import type {
  RuntimeHostArtifactRequest,
  RuntimeHostArtifactRequestMap,
  RuntimeHostArtifactRequestName,
  RuntimeHostArtifactResponseMap,
} from './protocol.ts'

type RuntimeHostArtifactRequestHandlerMap = {
  [TName in RuntimeHostArtifactRequestName]: (
    payload: RuntimeHostArtifactRequestMap[TName],
  ) => RuntimeHostArtifactResponseMap[TName]
}

const runtimeHostArtifactRequestHandlers = {
  createArtifact: (payload) => createArtifact(payload),
  editArtifact: (payload) => editArtifact(payload),
  getArtifact: (payload) => getArtifact(payload.artifactSlug, payload.conversationId),
  listArtifacts: (payload) => listArtifacts(payload.conversationId),
} satisfies RuntimeHostArtifactRequestHandlerMap

export function handleRuntimeHostArtifactRequest<TName extends RuntimeHostArtifactRequestName>(
  message: RuntimeHostArtifactRequest<TName>,
): RuntimeHostArtifactResponseMap[TName] {
  const handler = runtimeHostArtifactRequestHandlers[message.name] as unknown as (
    payload: RuntimeHostArtifactRequestMap[TName],
  ) => RuntimeHostArtifactResponseMap[TName]
  return handler(message.payload)
}
