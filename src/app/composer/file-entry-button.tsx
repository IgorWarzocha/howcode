import { Check, File, Folder } from 'lucide-react'
import { type DragEvent, useState } from 'react'
import type { ComposerAttachment } from '../desktop/types'
import { appToneTextClass, appTypeTinyClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { resolveFileEntryActivation } from './composer-file-picker.helpers'

type FileEntryButtonProps = {
  attachment: ComposerAttachment
  isAlreadyAttached: boolean
  onOpenDirectory?: (path: string) => void
  onRemoveAttachment: (attachmentPath: string) => void
  onDragStart: (attachment: ComposerAttachment, event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onToggleFile: (attachment: ComposerAttachment) => void
}

function getAttachmentIcon(attachment: ComposerAttachment, selected: boolean) {
  if (selected) {
    return <Check size={11} className="block -translate-y-px" />
  }

  if (attachment.kind === 'directory') {
    return <Folder size={11} className="block -translate-y-px" />
  }

  return <File size={11} className="block -translate-y-px" />
}

export function FileEntryButton({
  attachment,
  isAlreadyAttached,
  onOpenDirectory,
  onRemoveAttachment,
  onDragStart,
  onDragEnd,
  onToggleFile,
}: FileEntryButtonProps) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <button
      type="button"
      draggable={!isAlreadyAttached}
      className={cn(
        'flex h-8 min-w-0 w-full items-center gap-1 rounded-md bg-transparent px-2 text-left transition-colors',
        appTypeTinyClass,
        appToneTextClass,
        isAlreadyAttached && 'bg-[color:var(--surface-hover)]',
        isAlreadyAttached &&
          'cursor-default text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)]',
        !isAlreadyAttached && 'hover:bg-[color:var(--surface-hover)]',
        isDragging && 'opacity-70',
      )}
      onClick={() => {
        if (attachment.kind === 'directory') {
          return
        }

        const nextAction = resolveFileEntryActivation({
          attachment,
          isAlreadyAttached,
        })

        if (nextAction.type === 'toggle') {
          onToggleFile(nextAction.attachment)
        } else if (nextAction.type === 'remove') {
          onRemoveAttachment(nextAction.attachmentPath)
        }
      }}
      onDoubleClick={() => {
        if (attachment.kind === 'directory') {
          onOpenDirectory?.(attachment.path)
        }
      }}
      onDragStart={(event) => {
        setIsDragging(true)
        onDragStart(attachment, event)
      }}
      onDragEnd={() => {
        setIsDragging(false)
        onDragEnd()
      }}
      aria-label={`${isAlreadyAttached ? 'Remove' : 'Attach'} ${attachment.name}`}
    >
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[color:var(--muted)]">
        {getAttachmentIcon(attachment, isAlreadyAttached)}
      </span>
      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
    </button>
  )
}
