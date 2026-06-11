import {
  type DragEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnchoredPopoverPanel, PopoverPanel } from '../common/popover'
import type { ComposerAttachment, ComposerFilePickerState } from '../desktop/types'
import {
  appToneDangerClass,
  appTypeMetaClass,
  composerAttachmentPickerTextClass,
  composerPopoverInputLayerClass,
  popoverPanelClass,
} from '../ui/classes'
import { cn } from '../utils/cn'
import {
  canUploadComposerFiles,
  uploadComposerFilesAsAttachments,
} from './composer-browser-file-uploads'
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
  embedded?: boolean
  embeddedTopRounded?: boolean | undefined
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
  embedded = false,
  embeddedTopRounded = true,
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
  const [uploadingDeviceFiles, setUploadingDeviceFiles] = useState(false)
  const [portalPlacementEnabled, setPortalPlacementEnabled] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const deviceFileInputRef = useRef<HTMLInputElement>(null)
  const browserUploadAvailable = canUploadComposerFiles()

  useLayoutEffect(() => {
    const updatePlacementMode = () => {
      if (embedded) {
        setPortalPlacementEnabled(false)
        return
      }
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
  }, [anchorRef, embedded, preferPortalPlacement])

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
  const showAttachmentsPanel =
    browserUploadAvailable || attachments.length > 0 || draggedAttachments.length > 0 || dropActive

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

  const handleDeviceFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) {
      return
    }

    setUploadingDeviceFiles(true)
    try {
      const uploadedAttachments = await uploadComposerFilesAsAttachments(files)
      if (uploadedAttachments.length > 0) {
        onAttachAttachments(uploadedAttachments)
      }
    } catch (error) {
      console.error('Failed to attach browser files.', error)
    } finally {
      setUploadingDeviceFiles(false)
      if (deviceFileInputRef.current) {
        deviceFileInputRef.current.value = ''
      }
    }
  }

  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus()
    }
  }, [searchExpanded])

  const panelContents = (
    <>
      {browserUploadAvailable ? (
        <input
          ref={deviceFileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleDeviceFiles(event.currentTarget.files)}
        />
      ) : null}
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
            browserUploadAvailable={browserUploadAvailable}
            draggedAttachments={draggedAttachments}
            dropActive={dropActive}
            uploadingDeviceFiles={uploadingDeviceFiles}
            onDragActiveChange={setDropActive}
            onDrop={handleDropIntoAttachments}
            onPickDeviceFiles={() => deviceFileInputRef.current?.click()}
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
    'grid grid-rows-[40px_minmax(0,1fr)] overflow-hidden rounded-xl border-0 p-0',
    composerAttachmentPickerTextClass,
    embedded
      ? 'relative h-[min(378px,calc(70vh-8rem))] min-h-[220px] w-full'
      : portalPlacementEnabled
        ? 'h-[min(378px,calc(100vh-1.5rem))] min-h-[220px] w-[min(38rem,calc(100vw-1.5rem))]'
        : cn(
            'absolute right-0 bottom-full left-0 h-[min(378px,calc(100vh-12rem))] min-h-[220px]',
            composerPopoverInputLayerClass,
          ),
    embedded
      ? cn(
          embeddedTopRounded ? 'rounded-t-lg' : 'rounded-t-none',
          'rounded-b-none bg-[color:var(--panel)] shadow-none outline outline-1 -outline-offset-1 outline-[color:var(--border)]',
        )
      : popoverPanelClass,
  )

  if (embedded) {
    return (
      <PopoverPanel ref={panelRef} className={panelClassName}>
        {panelContents}
      </PopoverPanel>
    )
  }

  if (portalPlacementEnabled && anchorRef) {
    return (
      <AnchoredPopoverPanel
        anchorRef={anchorRef}
        panelRef={panelRef}
        open
        placement="right"
        portalClassName={composerPopoverInputLayerClass}
        className={panelClassName}
      >
        {panelContents}
      </AnchoredPopoverPanel>
    )
  }

  return (
    <PopoverPanel ref={panelRef} className={panelClassName}>
      {panelContents}
    </PopoverPanel>
  )
}
