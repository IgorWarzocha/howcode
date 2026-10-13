import { Suspense } from 'react'
import { InstalledArtifactPanel as ArtifactPanel } from '../component-system/artifact-renderer-slot'
import type { WorkspaceArtifactDrawerState } from './useWorkspaceArtifactDrawerState'

function ArtifactDrawer(props: {
  artifactDrawer: WorkspaceArtifactDrawerState
  conversationId: string | null | undefined
}) {
  const { artifactDrawer, conversationId } = props
  if (!(artifactDrawer.artifactDrawerPresent && !artifactDrawer.artifactsFullscreen)) return null
  return (
    <div
      className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden"
      style={artifactDrawer.artifactDrawerStyle}
    >
      <div
        ref={artifactDrawer.artifactDrawerRef}
        data-open={artifactDrawer.artifactDrawerVisible ? 'true' : 'false'}
        className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${artifactDrawer.artifactDrawerVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <Suspense fallback={null}>
          <ArtifactPanel
            rendererName={artifactDrawer.artifactRendererName}
            conversationId={conversationId ?? null}
            visible={artifactDrawer.artifactDrawerPresent}
            fullscreen={false}
            onToggleFullscreen={() => artifactDrawer.setArtifactsFullscreen(true)}
            onClose={artifactDrawer.handleCloseArtifacts}
          />
        </Suspense>
      </div>
    </div>
  )
}

function ArtifactFullscreen(props: {
  artifactDrawer: WorkspaceArtifactDrawerState
  conversationId: string | null | undefined
}) {
  const { artifactDrawer, conversationId } = props
  if (!artifactDrawer.artifactsFullscreen) return null
  return (
    <div className="absolute inset-0 z-20 min-h-0 overflow-hidden">
      <Suspense fallback={null}>
        <ArtifactPanel
          rendererName={artifactDrawer.artifactRendererName}
          conversationId={conversationId ?? null}
          visible={artifactDrawer.artifactsVisible}
          fullscreen={artifactDrawer.artifactsFullscreen}
          onToggleFullscreen={() => artifactDrawer.setArtifactsFullscreen(false)}
          onClose={artifactDrawer.handleCloseArtifacts}
        />
      </Suspense>
    </div>
  )
}

export function ArtifactDrawerViews(props: {
  artifactDrawer: WorkspaceArtifactDrawerState
  conversationId: string | null | undefined
}) {
  return (
    <>
      <ArtifactDrawer {...props} />
      <ArtifactFullscreen {...props} />
    </>
  )
}
