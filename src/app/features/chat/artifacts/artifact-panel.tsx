import {
  Check,
  ChevronDown,
  Download,
  FileCode2,
  List,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Play,
  Save,
} from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent,
  lazy,
  type PointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { SurfacePanel } from '../../../components/common/surface-panel'
import { Tooltip } from '../../../components/common/tooltip'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import { compactIconButtonClass, popoverPanelClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { HistoricalMarkdownPreview } from './artifact-markdown-preview'
import { formatArtifactSlug } from './artifactFormat'
import { useArtifactPanelState } from './useArtifactPanelState'

const ArtifactMarkdownEditor = lazy(async () => {
  const { default: Prism } = await import('prismjs')
  // @mdxeditor/@lexical code highlighting expects Prism on the browser global.
  // Install it only on the markdown editor path so HTML/React previews stay isolated.
  globalThis.Prism = Prism
  const module = await import('./artifact-markdown-editor')
  return { default: module.ArtifactMarkdownEditor }
})

type ArtifactPanelProps = {
  conversationId: string | null
  visible: boolean
  fullscreen: boolean
  onToggleFullscreen: () => void
  onClose: () => void
}

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

function ArtifactPanelBody({
  fullscreen,
  panel,
}: {
  fullscreen: boolean
  panel: ReturnType<typeof useArtifactPanelState>
}) {
  const {
    artifacts,
    artifactLoadError,
    displayedContent,
    draft,
    markdownPreviewEditable,
    previewError,
    previewHtml,
    previewRevision,
    selectedArtifact,
    setDraft,
    setPreviewError,
    setPreviewSource,
    setSelectedArtifactId,
    setView,
    showingHistoricalVersion,
    view,
  } = panel
  if (artifactLoadError)
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--danger)]">
        {artifactLoadError}
      </div>
    )
  if (panel.loadingArtifacts)
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--muted)]">
        Loading artifacts…
      </div>
    )
  if (artifacts.length === 0)
    return (
      <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--muted)]">
        No artifacts yet.
      </div>
    )
  if (view === 'list') {
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
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                {artifact.kind} · v{artifact.version}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (view === 'code')
    return (
      <textarea
        className="h-full w-full resize-none overflow-auto bg-[color:var(--panel)] p-3 font-mono text-[12px] leading-5 text-[color:var(--text)] outline-none"
        value={draft}
        spellCheck={false}
        readOnly={showingHistoricalVersion}
        onChange={(event) => setDraft(event.target.value)}
      />
    )
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
  if (view === 'preview' && selectedArtifact?.kind === 'markdown' && showingHistoricalVersion)
    return <HistoricalMarkdownPreview content={displayedContent} />
  if (view === 'preview' && selectedArtifact?.kind !== 'markdown') {
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
  return null
}

function ArtifactVersionSelect({ panel }: { panel: ReturnType<typeof useArtifactPanelState> }) {
  const { selectedArtifact, selectedVersion, setSelectedVersion, versions } = panel
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>(undefined)
  const [positionReady, setPositionReady] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setOpen(false), [])

  useDismissibleLayer({ open, onDismiss: closeMenu, refs: [buttonRef, menuRef] })

  useLayoutEffect(() => {
    if (!open) {
      setPositionReady(false)
      return
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(rect.width, 112)
      setMenuStyle({
        left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
        top: rect.bottom + 6,
        width,
      })
      setPositionReady(true)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  if (!selectedArtifact) return null
  const options = [
    { label: `Latest v${selectedArtifact.version}`, value: 'latest' as const },
    ...versions.flatMap((version) =>
      version.version === selectedArtifact.version
        ? []
        : [{ label: `v${version.version}`, value: version.version }],
    ),
  ]
  const selectedLabel =
    options.find((option) => option.value === selectedVersion)?.label ??
    (selectedVersion === 'latest' ? `Latest v${selectedArtifact.version}` : `v${selectedVersion}`)
  const handleTriggerPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setOpen((current) => !current)
  }
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!(event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) return
    event.preventDefault()
    setOpen(true)
  }
  const selectOption = (value: (typeof options)[number]['value']) => {
    setSelectedVersion(value)
    closeMenu()
  }
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="artifact-version-trigger inline-flex h-7 max-w-28 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-2)] px-2 text-[color:var(--muted)] outline-none transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
        onPointerDown={handleTriggerPointerDown}
        onKeyDown={handleTriggerKeyDown}
        aria-label="Artifact version"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <SurfacePanel
              ref={menuRef}
              data-open={positionReady ? 'true' : 'false'}
              className={cn(
                popoverPanelClass,
                'motion-popover fixed z-[120] grid gap-0.5 rounded-xl p-1',
              )}
              style={menuStyle}
              role="listbox"
              aria-label="Artifact version"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === selectedVersion}
                  className={cn(
                    'artifact-version-option grid grid-cols-[14px_minmax(0,1fr)] items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
                    option.value === selectedVersion &&
                      'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
                  )}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    selectOption(option.value)
                  }}
                  onClick={() => selectOption(option.value)}
                >
                  {option.value === selectedVersion ? <Check size={12} /> : <span />}
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </SurfacePanel>,
            document.body,
          )
        : null}
    </>
  )
}

function ArtifactViewToggle({ panel }: { panel: ReturnType<typeof useArtifactPanelState> }) {
  const { selectedArtifact, setView, view } = panel
  if (selectedArtifact?.kind === 'markdown') return null
  return (
    <button
      type="button"
      className={cn(
        compactIconButtonClass,
        'h-7 w-7',
        view !== 'list' && 'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
      )}
      onClick={() => setView(view === 'code' ? 'preview' : 'code')}
      disabled={!selectedArtifact}
      aria-label={view === 'code' ? 'Show artifact preview' : 'Show artifact code'}
      data-tooltip={view === 'code' ? 'Preview' : 'Code'}
    >
      {view === 'code' ? <Play size={14} /> : <FileCode2 size={14} />}
    </button>
  )
}

function ArtifactSaveButton({ panel }: { panel: ReturnType<typeof useArtifactPanelState> }) {
  const { saveDisabled, saveDraft, selectedArtifact, showingHistoricalVersion } = panel
  return (
    <button
      type="button"
      className={cn(compactIconButtonClass, 'h-7 w-7')}
      onClick={() => void saveDraft()}
      disabled={saveDisabled}
      aria-label="Save artifact"
      data-tooltip={
        showingHistoricalVersion
          ? `Save snapshot as latest v${(selectedArtifact?.version ?? 0) + 1}`
          : 'Save artifact'
      }
    >
      <Save size={14} />
    </button>
  )
}

function ArtifactDownloadButton({ panel }: { panel: ReturnType<typeof useArtifactPanelState> }) {
  const { downloadArtifact, downloadStatus, selectedArtifact } = panel
  return (
    <Tooltip
      content={downloadStatus ?? 'Download'}
      placement="left"
      className="inline-flex shrink-0"
      contentClassName={
        downloadStatus ? 'max-w-[min(520px,calc(100vw-3rem))] whitespace-nowrap' : undefined
      }
    >
      <button
        type="button"
        className={cn(compactIconButtonClass, 'h-7 w-7')}
        onClick={() => void downloadArtifact()}
        disabled={!selectedArtifact}
        aria-label={downloadStatus ?? 'Download artifact'}
      >
        <Download size={14} />
      </button>
    </Tooltip>
  )
}

function ArtifactPanelHeader({
  fullscreen,
  onClose,
  onToggleFullscreen,
  panel,
}: {
  fullscreen: boolean
  onClose: () => void
  onToggleFullscreen: () => void
  panel: ReturnType<typeof useArtifactPanelState>
}) {
  const { selectedArtifact, setView, view } = panel
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 border-b border-[color:var(--border)] px-2 py-2 min-[420px]:gap-3 min-[420px]:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-[color:var(--text)]">
        <FileCode2 size={15} className="shrink-0 text-[color:var(--muted)]" />
        {selectedArtifact ? (
          <span className="truncate font-medium">{formatArtifactSlug(selectedArtifact.slug)}</span>
        ) : null}
      </div>
      <div className="flex min-w-0 shrink items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ArtifactVersionSelect panel={panel} />
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'h-7 w-7',
            view === 'list' && 'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
          )}
          onClick={() => setView('list')}
          aria-label="Show artifact list"
          data-tooltip="Artifact list"
        >
          <List size={14} />
        </button>
        <ArtifactViewToggle panel={panel} />
        <ArtifactSaveButton panel={panel} />
        <ArtifactDownloadButton panel={panel} />
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'h-7 w-7',
            fullscreen && 'bg-[color:var(--accent-bg)] text-[color:var(--text)]',
          )}
          aria-label={fullscreen ? 'Exit artifact fullscreen' : 'Artifact fullscreen'}
          onClick={onToggleFullscreen}
          data-tooltip={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          data-tooltip-placement="left"
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
          aria-label="Hide artifacts"
          onClick={onClose}
          data-tooltip="Hide artifacts"
          data-tooltip-placement="left"
        >
          <PanelRightClose size={14} />
        </button>
      </div>
    </div>
  )
}

export function ArtifactPanel({
  conversationId,
  visible,
  fullscreen,
  onToggleFullscreen,
  onClose,
}: ArtifactPanelProps) {
  const panel = useArtifactPanelState(conversationId)

  if (!(visible && conversationId)) return null

  return (
    <section
      aria-label="Artifacts drawer"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-l border-[color:var(--border)] bg-[color:var(--workspace)]"
    >
      <ArtifactPanelHeader
        fullscreen={fullscreen}
        onClose={onClose}
        onToggleFullscreen={onToggleFullscreen}
        panel={panel}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[color:var(--sidebar)]">
        <ArtifactPanelBody fullscreen={fullscreen} panel={panel} />
      </div>
    </section>
  )
}
