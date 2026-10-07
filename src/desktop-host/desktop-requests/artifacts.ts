import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PiThreadsService } from '../../../shared/desktop-service-contracts'

type ArtifactsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listArtifacts'
  | 'getArtifact'
  | 'updateArtifact'
  | 'editArtifact'
  | 'listArtifactVersions'
  | 'compileReactArtifact'
>

export function createArtifactsHandlers(piThreads: PiThreadsService): ArtifactsRequestHandlers {
  return {
    listArtifacts: (request) => piThreads.listArtifacts(request?.conversationId ?? null),
    getArtifact: ({ artifactSlug, conversationId }) =>
      piThreads.getArtifact(artifactSlug, conversationId ?? null),
    updateArtifact: ({ artifactSlug, content, conversationId }) =>
      piThreads.updateArtifact({
        slug: artifactSlug,
        content,
        conversationId: conversationId ?? null,
      }),
    editArtifact: ({ artifactSlug, edits, conversationId }) =>
      piThreads.editArtifact({ slug: artifactSlug, edits, conversationId: conversationId ?? null }),
    listArtifactVersions: ({ artifactSlug }) => piThreads.listArtifactVersions(artifactSlug),
    compileReactArtifact: ({ source }) => piThreads.compileReactArtifact(source),
  }
}
