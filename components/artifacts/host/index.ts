import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { ArtifactsService } from '../../../shared/desktop-service-contracts'

type ArtifactsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listArtifacts'
  | 'getArtifact'
  | 'updateArtifact'
  | 'editArtifact'
  | 'listArtifactVersions'
  | 'compileReactArtifact'
>

export function createArtifactsHandlers(artifacts: ArtifactsService): ArtifactsRequestHandlers {
  return {
    listArtifacts: (request) => artifacts.listArtifacts(request?.conversationId ?? null),
    getArtifact: ({ artifactSlug, conversationId }) =>
      artifacts.getArtifact(artifactSlug, conversationId ?? null),
    updateArtifact: ({ artifactSlug, content, conversationId }) =>
      artifacts.updateArtifact({
        slug: artifactSlug,
        content,
        conversationId: conversationId ?? null,
      }),
    editArtifact: ({ artifactSlug, edits, conversationId }) =>
      artifacts.editArtifact({ slug: artifactSlug, edits, conversationId: conversationId ?? null }),
    listArtifactVersions: ({ artifactSlug }) => artifacts.listArtifactVersions(artifactSlug),
    compileReactArtifact: ({ source }) => artifacts.compileReactArtifact(source),
  }
}
