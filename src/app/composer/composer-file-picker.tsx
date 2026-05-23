import {
  type CSSProperties,
  type DragEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { PopoverPanel, PopoverPortalLayer, useAnchoredPopoverPosition } from '../common/popover'
import type { ComposerAttachment, ComposerFilePickerState } from '../desktop/types'
import { appToneDangerClass, appTypeMetaClass, popoverPanelClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { ComposerFilePickerAttachmentsPanel } from './composer-file-picker-attachments-panel'
import { ComposerFilePickerFileGrid } from './composer-file-picker-file-grid'
import { ComposerFilePickerHeader } from './composer-file-picker-header'
import {
  buildFilePickerRootOptions,
  filterFilePickerEntries,
  getDroppedComposerAttachments,
} from './composer-file-picker-utils'

type ComposerFilePickerProps = {
  anchorRef?: RefObject<HTMLButtonElement | null>
  attachments: ComposerAttachment[]
  errorMessage: string | null
  favoriteFolders: string[]
  loading: boolean
  picker: ComposerFilePickerState | null
  panelRef: RefObject<HTMLDivElement | null>
  preferPortalPlacement?: boolean
  projectRootPath: string
  onAttachAttachments: (
    attachments: ComposerAttachment[],
    options?: { closeMenu?: boolean } | undefined,
  ) => void
  onOpenRoot: (path: string) => void
  onOpenDirectory: (path: string) => void
  onRemoveAttachment: (attachmentPath: string) => void
  onToggleFile: (attachment: ComposerAttachment) => void
}

export function ComposerFilePicker({
  anchorRef,
  attachments,
  errorMessage,
  favoriteFolders,
  loading,
  picker,
  panelRef,
  preferPortalPlacement = false,
  projectRootPath,
  onAttachAttachments,
  onOpenRoot,
  onOpenDirectory,
  onRemoveAttachment,
  onToggleFile,
}: ComposerFilePickerProps) {
  const [draggedAttachments, setDraggedAttachments] = useState<ComposerAttachment[]>([])
  const [dropActive, setDropActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [portalPlacementEnabled, setPortalPlacementEnabled] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const updatePlacementMode = () => {
      const anchorRect = anchorRef?.current?.getBoundingClientRect()
      const estimatedPanelHeight = Math.min(378, window.innerHeight - 12 * 2)
      setPortalPlacementEnabled(
        Boolean(
          anchorRect && (preferPortalPlacement || anchorRect.top < estimatedPanelHeight + 8 + 12),
        ),
      )
    }

    updatePlacementMode()
    window.addEventListener('resize', updatePlacementMode)
    window.addEventListener('scroll', updatePlacementMode, true)
    return () => {
      window.removeEventListener('resize', updatePlacementMode)
      window.removeEventListener('scroll', updatePlacementMode, true)
    }
  }, [anchorRef, preferPortalPlacement])

  const attachedByPath = useMemo(
    () => new Set(attachments.map((attachment) => attachment.path)),
    [attachments],
  )
  const rootOptions = useMemo(
    () => buildFilePickerRootOptions({ favoriteFolders, picker, projectRootPath }),
    [favoriteFolders, picker, projectRootPath],
  )
  const filteredEntries = useMemo(
    () => filterFilePickerEntries(picker?.entries ?? [], searchQuery),
    [picker?.entries, searchQuery],
  )
  const showAttachmentsPanel = attachments.length > 0 || draggedAttachments.length > 0 || dropActive

  const handleEntryDragStart = (
    attachment: ComposerAttachment,
    event: DragEvent<HTMLButtonElement>,
  ) => {
    const nextDraggedAttachments = [attachment]

    setDraggedAttachments(nextDraggedAttachments)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(
      'application/x-howcode-attachments',
      JSON.stringify(nextDraggedAttachments.map((candidate) => candidate.path)),
    )
  }

  const handleDragEnd = () => {
    setDraggedAttachments([])
    setDropActive(false)
  }

  const handleDropIntoAttachments = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (draggedAttachments.length > 0) {
      onAttachAttachments(draggedAttachments)
      handleDragEnd()
      return
    }

    try {
      const externalAttachments = await getDroppedComposerAttachments(event.dataTransfer)
      if (externalAttachments.length > 0) {
        onAttachAttachments(externalAttachments)
      }
    } finally {
      setDropActive(false)
    }
  }

  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus()
    }
  }, [searchExpanded])

  const { position: portalPosition, positionReady: portalPositionReady } =
    useAnchoredPopoverPosition({
      anchorRef: anchorRef ?? ({ current: null } as RefObject<HTMLButtonElement | null>),
      panelRef,
      enabled: portalPlacementEnabled,
      placement: 'right',
    })

  const panelContents = (
    <>
      <ComposerFilePickerHeader
        picker={picker}
        projectRootPath={projectRootPath}
        rootOptions={rootOptions}
        searchExpanded={searchExpanded}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        onOpenDirectory={onOpenDirectory}
        onOpenRoot={onOpenRoot}
        onSearchExpandedChange={setSearchExpanded}
        onSearchQueryChange={setSearchQuery}
      />

      <div
        className={cn(
          'grid min-h-0 overflow-hidden',
          showAttachmentsPanel
            ? 'w-full grid-cols-[minmax(7.5rem,0.34fr)_minmax(0,1fr)]'
            : 'grid-cols-1',
        )}
      >
        {showAttachmentsPanel ? (
          <ComposerFilePickerAttachmentsPanel
            attachments={attachments}
            draggedAttachments={draggedAttachments}
            dropActive={dropActive}
            onDragActiveChange={setDropActive}
            onDrop={handleDropIntoAttachments}
            onRemoveAttachment={onRemoveAttachment}
          />
        ) : null}

        <ComposerFilePickerFileGrid
          attachedByPath={attachedByPath}
          entries={filteredEntries}
          loading={loading}
          picker={picker}
          searchQuery={searchQuery}
          onOpenDirectory={onOpenDirectory}
          onRemoveAttachment={onRemoveAttachment}
          onEntryDragStart={handleEntryDragStart}
          onEntryDragEnd={handleDragEnd}
          onToggleFile={onToggleFile}
        />
      </div>

      {errorMessage ? (
        <div
          className={cn(
            'pointer-events-none absolute right-3 bottom-2 left-3 truncate',
            appTypeMetaClass,
            appToneDangerClass,
          )}
        >
          {errorMessage}
        </div>
      ) : null}
    </>
  )

  const panelClassName = cn(
    'grid grid-rows-[40px_minmax(0,1fr)] overflow-hidden rounded-xl border-0 p-0 shadow-[var(--shadow)]',
    portalPlacementEnabled
      ? 'fixed z-[120] h-[min(378px,calc(100vh-1.5rem))] min-h-[220px] w-[min(38rem,calc(100vw-1.5rem))] transition-opacity duration-150 ease-out'
      : 'absolute right-0 bottom-full left-0 z-[70] h-[min(378px,calc(100vh-12rem))] min-h-[220px]',
    portalPlacementEnabled && !portalPositionReady && 'pointer-events-none opacity-0',
    popoverPanelClass,
  )

  const panelStyle: CSSProperties | undefined = portalPlacementEnabled
    ? { left: `${portalPosition.left}px`, top: `${portalPosition.top}px` }
    : undefined

  if (portalPlacementEnabled && typeof document !== 'undefined') {
    return createPortal(
      <PopoverPortalLayer className="z-[220]">
        <PopoverPanel ref={panelRef} className={panelClassName} style={panelStyle}>
          {panelContents}
        </PopoverPanel>
      </PopoverPortalLayer>,
      document.body,
    )
  }

  return (
    <PopoverPanel ref={panelRef} className={panelClassName}>
      {panelContents}
    </PopoverPanel>
  )
}
