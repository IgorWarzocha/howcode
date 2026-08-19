import type {
  RuntimeHostArtifactRequestMap,
  RuntimeHostArtifactRequestName,
  RuntimeHostArtifactResponseMap,
} from './protocol.ts'

export async function invokeArtifactRequest<TName extends RuntimeHostArtifactRequestName>(
  name: TName,
  payload: RuntimeHostArtifactRequestMap[TName],
): Promise<RuntimeHostArtifactResponseMap[TName]> {
  const { handleRuntimeHostArtifactRequest } = await import('./artifact-request-handlers.ts')
  return handleRuntimeHostArtifactRequest({
    name,
    payload,
  })
}
