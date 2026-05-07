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
import type { ComposerAttachment, ComposerFilePickerState } from '../../../desktop/types'
import { popoverPanelClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { SurfacePanel } from '../../common/surface-panel'
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
  preferSidePlacement?: boolean
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

const sidePlacementGap = 8
const sidePlacementViewportPadding = 12

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function ComposerFilePicker({
  anchorRef,
  attachments,
  errorMessage,
  favoriteFolders,
  loading,
  picker,
  panelRef,
  preferSidePlacement = false,
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
  const [sidePlacementEnabled, setSidePlacementEnabled] = useState(false)
  const [sidePosition, setSidePosition] = useState({ left: 0, top: 0 })
  const [sidePositionReady, setSidePositionReady] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const updatePlacementMode = () => {
      const anchorRect = anchorRef?.current?.getBoundingClientRect()
      const estimatedPanelHeight = Math.min(
        378,
        window.innerHeight - sidePlacementViewportPadding * 2,
      )
      setSidePlacementEnabled(
        Boolean(
          anchorRect &&
            (preferSidePlacement ||
              anchorRect.top <
                estimatedPanelHeight + sidePlacementGap + sidePlacementViewportPadding),
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
  }, [anchorRef, preferSidePlacement])

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

  useLayoutEffect(() => {
    if (!sidePlacementEnabled) {
      setSidePositionReady(false)
      return
    }

    const updatePosition = (event?: Event) => {
      const target = event?.target instanceof Node ? event.target : null
      if (target && panelRef.current?.contains(target)) {
        return
      }

      const anchorRect = anchorRef?.current?.getBoundingClientRect()
      const panelRect = panelRef.current?.getBoundingClientRect()

      if (!(anchorRect && panelRect)) {
        return
      }

      const maxLeft = window.innerWidth - panelRect.width - sidePlacementViewportPadding
      const preferredLeft = anchorRect.right + sidePlacementGap
      const left = clamp(
        preferredLeft,
        sidePlacementViewportPadding,
        Math.max(sidePlacementViewportPadding, maxLeft),
      )
      const maxTop = window.innerHeight - panelRect.height - sidePlacementViewportPadding
      const centeredTop = anchorRect.top + anchorRect.height / 2 - panelRect.height / 2
      const top = clamp(
        centeredTop,
        sidePlacementViewportPadding,
        Math.max(sidePlacementViewportPadding, maxTop),
      )

      setSidePosition((current) => {
        if (current.left === left && current.top === top) {
          return current
        }

        return { left, top }
      })
      setSidePositionReady(true)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, panelRef, sidePlacementEnabled])

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
        <div className="pointer-events-none absolute right-3 bottom-2 left-3 truncate text-[11px] text-[color:var(--danger)]">
          {errorMessage}
        </div>
      ) : null}
    </>
  )

  const panelClassName = cn(
    'grid grid-rows-[44px_minmax(0,1fr)] overflow-hidden rounded-[20px] border-[color:var(--border-strong)] p-0 shadow-[0_18px_40px_rgba(0,0,0,0.28)]',
    sidePlacementEnabled
      ? 'fixed z-[120] h-[min(378px,calc(100vh-1.5rem))] min-h-[220px] w-[min(38rem,calc(100vw-1.5rem))] transition-opacity duration-150 ease-out'
      : 'absolute right-0 bottom-full left-0 z-[70] h-[min(378px,calc(100vh-12rem))] min-h-[220px]',
    sidePlacementEnabled && !sidePositionReady && 'pointer-events-none opacity-0',
    popoverPanelClass,
  )

  const panelStyle: CSSProperties | undefined = sidePlacementEnabled
    ? { left: `${sidePosition.left}px`, top: `${sidePosition.top}px` }
    : undefined

  if (sidePlacementEnabled && typeof document !== 'undefined') {
    return createPortal(
      <SurfacePanel ref={panelRef} className={panelClassName} style={panelStyle}>
        {panelContents}
      </SurfacePanel>,
      document.body,
    )
  }

  return (
    <SurfacePanel ref={panelRef} className={panelClassName}>
      {panelContents}
    </SurfacePanel>
  )
}
