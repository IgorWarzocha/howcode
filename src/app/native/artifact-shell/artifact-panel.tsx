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
import { type KeyboardEvent, type PointerEvent, useCallback, useRef, useState } from 'react'
import { AnchoredPopoverPanel } from '../../common/popover'
import { Tooltip } from '../../common/tooltip'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import {
  appTypeGroupTitleClass,
  artifactBodyClass,
  artifactHeaderClass,
  artifactHeaderControlActiveClass,
  artifactHeaderControlsClass,
  artifactHeaderTitleClass,
  artifactVersionTriggerClass,
  compactIconButtonClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverPanelClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { ArtifactPanelBody } from './artifact-panel-body'
import { formatArtifactSlug } from './artifactFormat'
import { useArtifactPanelState } from './useArtifactPanelState'

type ArtifactPanelProps = {
  conversationId: string | null
  visible: boolean
  fullscreen: boolean
  onToggleFullscreen: () => void
  onClose: () => void
}

function ArtifactVersionSelect({ panel }: { panel: ReturnType<typeof useArtifactPanelState> }) {
  const { selectedArtifact, selectedVersion, setSelectedVersion, versions } = panel
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setOpen(false), [])

  useDismissibleLayer({ open, onDismiss: closeMenu, refs: [buttonRef, menuRef] })

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
        className={artifactVersionTriggerClass}
        onPointerDown={handleTriggerPointerDown}
        onKeyDown={handleTriggerKeyDown}
        aria-label="Artifact version"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      <AnchoredPopoverPanel
        anchorRef={buttonRef}
        panelRef={menuRef}
        open={open}
        placement="bottom-start"
        gap={6}
        surface={false}
        className={cn(composerPopoverPanelClass, 'z-[120] grid min-w-28 gap-0.5')}
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
              composerPopoverOptionClass,
              'artifact-version-option h-7 grid-cols-[14px_minmax(0,1fr)] px-2',
              option.value === selectedVersion && composerPopoverOptionSelectedClass,
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
      </AnchoredPopoverPanel>
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
        view !== 'list' && artifactHeaderControlActiveClass,
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
    <div className={artifactHeaderClass}>
      <div className={artifactHeaderTitleClass}>
        <FileCode2 size={15} className="shrink-0 text-[color:var(--muted)]" />
        {selectedArtifact ? (
          <span className={`truncate ${appTypeGroupTitleClass}`}>
            {formatArtifactSlug(selectedArtifact.slug)}
          </span>
        ) : null}
      </div>
      <div className={artifactHeaderControlsClass}>
        <ArtifactVersionSelect panel={panel} />
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'h-7 w-7',
            view === 'list' && artifactHeaderControlActiveClass,
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
            fullscreen && artifactHeaderControlActiveClass,
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
          className={viewCloseButtonClass}
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
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-l border-[color:var(--border)]/60 bg-[color:var(--workspace)]"
    >
      <ArtifactPanelHeader
        fullscreen={fullscreen}
        onClose={onClose}
        onToggleFullscreen={onToggleFullscreen}
        panel={panel}
      />

      <div className={artifactBodyClass}>
        <ArtifactPanelBody fullscreen={fullscreen} panel={panel} />
      </div>
    </section>
  )
}
