import { lazy, Suspense, useEffect, useState } from 'react'
import { cn } from '../../../utils/cn'
import { HistoricalMarkdownPreview } from './artifact-markdown-preview'
import { formatArtifactSlug } from './artifactFormat'
import type { useArtifactPanelState } from './useArtifactPanelState'

const ArtifactMarkdownEditor = lazy(async () => {
  const { default: Prism } = await import('prismjs')
  // @mdxeditor/@lexical code highlighting expects Prism on the browser global.
  // Install it only on the markdown editor path so HTML/React previews stay isolated.
  globalThis.Prism = Prism
  const module = await import('./artifact-markdown-editor')
  return { default: module.ArtifactMarkdownEditor }
})

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
    <div className="h-full overflow-y-auto p-2">
      <div className="grid gap-1">
        {artifacts.map((artifact) => (
          <button
            key={artifact.slug}
            type="button"
            className={cn(
              'rounded-lg px-3 py-2.5 text-left text-[12px] text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
              artifact.slug === selectedArtifact?.slug &&
                'bg-[color:var(--accent-bg-subtle)] text-[color:var(--text)]',
            )}
            onClick={() => {
              setSelectedArtifactId(artifact.slug)
              setView('preview')
            }}
          >
            <div className="truncate font-medium">{formatArtifactSlug(artifact.slug)}</div>
            <div className="mt-0.5 text-[10px] tracking-[0.12em] text-[color:var(--muted-2)] uppercase">
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
    <div className="relative h-full bg-[color:var(--sidebar)]">
      {previewError ? (
        <pre className="absolute right-2 bottom-2 left-2 z-10 max-h-32 overflow-auto rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--panel)] p-2 text-[11px] whitespace-pre-wrap text-[color:var(--danger)] shadow-[var(--shadow)]">
          {previewError}
        </pre>
      ) : null}
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
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--danger)]">
        {artifactLoadError}
      </div>
    )
  }
  if (loadingArtifacts) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--muted)]">
        Loading artifacts…
      </div>
    )
  }
  if (artifacts.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--muted)]">
        No artifacts yet.
      </div>
    )
  }
  if (view === 'list') return <ArtifactListView panel={panel} />
  if (view === 'code') {
    return (
      <textarea
        className="h-full w-full resize-none overflow-auto bg-[color:var(--panel)] p-3 font-mono text-[12px] leading-5 text-[color:var(--text)] outline-none"
        value={draft}
        spellCheck={false}
        readOnly={showingHistoricalVersion}
        onChange={(event) => setDraft(event.target.value)}
      />
    )
  }
  if (markdownPreviewEditable) {
    return (
      <Suspense
        fallback={
          <div className="grid h-full place-items-center text-[12px] text-[color:var(--muted)]">
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
