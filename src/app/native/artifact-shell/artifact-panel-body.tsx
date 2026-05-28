import { Component, lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import {
  appToneDangerClass,
  appToneMutedClass,
  appToneSubtleClass,
  appTypeSmallStrongClass,
  appTypeTinyClass,
  artifactCenteredStateClass,
  artifactCodeEditorClass,
  artifactErrorStripClass,
  artifactListClass,
  artifactListRowClass,
  artifactPreviewSurfaceClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { HistoricalMarkdownPreview } from '../markdown-artifacts/artifact-markdown-preview'
import { formatArtifactSlug } from './artifactFormat'
import type { useArtifactPanelState } from './useArtifactPanelState'

const ArtifactMarkdownEditor = lazy(async () => {
  const { default: Prism } = await import('prismjs')
  // @mdxeditor/@lexical code highlighting expects Prism on the browser global.
  // Install it only on the markdown editor path so HTML/React previews stay isolated.
  globalThis.Prism = Prism
  Object.assign(globalThis, { prism: Prism })
  const module = await import('@howcode/native-markdown-artifacts')
  return { default: module.ArtifactMarkdownEditor }
})

class ArtifactMarkdownEditorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  override state = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  override render() {
    if (this.state.error) {
      return <pre className={artifactErrorStripClass}>{this.state.error}</pre>
    }

    return this.props.children
  }
}

type ArtifactPanelState = ReturnType<typeof useArtifactPanelState>

function ArtifactPreviewIframe({
  previewHtml,
  previewRevision,
  selectedArtifactKey,
  setPreviewSource,
}: {
  previewHtml: string
  previewRevision: number
  selectedArtifactKey: string
  setPreviewSource: (source: MessageEventSource | null) => void
}) {
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!previewHtml) {
      setPreviewUrl('')
      return
    }

    const nextPreviewUrl = URL.createObjectURL(new Blob([previewHtml], { type: 'text/html' }))
    setPreviewUrl(nextPreviewUrl)
    return () => URL.revokeObjectURL(nextPreviewUrl)
  }, [previewHtml])

  if (!previewUrl) return null
  return (
    <iframe
      ref={(node) => setPreviewSource(node?.contentWindow ?? null)}
      key={`${selectedArtifactKey}:${previewRevision}:${previewUrl}`}
      sandbox="allow-scripts allow-forms allow-modals allow-popups"
      src={previewUrl}
      className="h-full w-full border-0"
      title="Artifact preview"
    />
  )
}

function ArtifactListView({ panel }: { panel: ArtifactPanelState }) {
  const { artifacts, selectedArtifact, setSelectedArtifactId, setView } = panel
  return (
    <div className={artifactListClass}>
      <div className="grid gap-0.5">
        {artifacts.map((artifact) => (
          <button
            key={artifact.slug}
            type="button"
            className={cn(
              artifactListRowClass,
              artifact.slug === selectedArtifact?.slug &&
                'bg-[color:var(--folded-row-bg)] text-[color:var(--text)]',
            )}
            onClick={() => {
              setSelectedArtifactId(artifact.slug)
              setView('preview')
            }}
          >
            <div className={`truncate ${appTypeSmallStrongClass}`}>
              {formatArtifactSlug(artifact.slug)}
            </div>
            <div
              className={`mt-0.5 ${appTypeTinyClass} tracking-[0.12em] ${appToneSubtleClass} uppercase`}
            >
              {artifact.kind} · v{artifact.version}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ArtifactPreviewView({ panel }: { panel: ArtifactPanelState }) {
  const { previewError, previewHtml, previewRevision, selectedArtifact, setPreviewSource } = panel
  return (
    <div className={artifactPreviewSurfaceClass}>
      {previewError ? <pre className={artifactErrorStripClass}>{previewError}</pre> : null}
      {previewHtml ? (
        <ArtifactPreviewIframe
          previewHtml={previewHtml}
          previewRevision={previewRevision}
          selectedArtifactKey={`${selectedArtifact?.slug}:${selectedArtifact?.version}:${selectedArtifact?.updatedAt}`}
          setPreviewSource={setPreviewSource}
        />
      ) : null}
    </div>
  )
}

export function ArtifactPanelBody({
  fullscreen,
  panel,
}: {
  fullscreen: boolean
  panel: ArtifactPanelState
}) {
  const {
    artifactLoadError,
    artifacts,
    displayedContent,
    draft,
    loadingArtifacts,
    markdownPreviewEditable,
    selectedArtifact,
    setDraft,
    setPreviewError,
    showingHistoricalVersion,
    view,
  } = panel

  if (artifactLoadError) {
    return (
      <div className={`${artifactCenteredStateClass} ${appToneDangerClass}`}>
        {artifactLoadError}
      </div>
    )
  }
  if (loadingArtifacts) {
    return (
      <div className={`${artifactCenteredStateClass} ${appToneMutedClass}`}>Loading artifacts…</div>
    )
  }
  if (artifacts.length === 0) {
    return (
      <div className={`${artifactCenteredStateClass} ${appToneMutedClass}`}>No artifacts yet.</div>
    )
  }
  if (view === 'list') return <ArtifactListView panel={panel} />
  if (view === 'code') {
    return (
      <textarea
        className={artifactCodeEditorClass}
        value={draft}
        spellCheck={false}
        readOnly={showingHistoricalVersion}
        onChange={(event) => setDraft(event.target.value)}
      />
    )
  }
  if (markdownPreviewEditable) {
    return (
      <ArtifactMarkdownEditorBoundary>
        <Suspense
          fallback={
            <div className={`${artifactCenteredStateClass} ${appToneMutedClass}`}>
              Loading markdown editor…
            </div>
          }
        >
          <ArtifactMarkdownEditor
            artifactKey={`${selectedArtifact?.slug}:${selectedArtifact?.version}`}
            content={draft}
            diffMarkdown={selectedArtifact?.content ?? ''}
            fullscreen={fullscreen}
            onChange={setDraft}
            onError={setPreviewError}
          />
        </Suspense>
      </ArtifactMarkdownEditorBoundary>
    )
  }
  if (view === 'preview' && selectedArtifact?.kind === 'markdown' && showingHistoricalVersion) {
    return <HistoricalMarkdownPreview content={displayedContent} />
  }
  if (view === 'preview' && selectedArtifact?.kind !== 'markdown') {
    return <ArtifactPreviewView panel={panel} />
  }
  return null
}
