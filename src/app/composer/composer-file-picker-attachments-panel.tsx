import { isSafeExternalUrl } from '@howcode/shared/external-url'
import { File, Folder, Globe, Loader2, Upload, X } from 'lucide-react'
import type { DragEvent } from 'react'
import type { ComposerAttachment } from '../desktop/types'
import { appToneMutedClass, appToneTextClass, appTypeTinyClass } from '../ui/classes'
import { cn } from '../utils/cn'
import {
  getAttachmentDisplayLabel,
  getOpenAttachmentLabel,
  openComposerAttachment,
} from './composer-file-picker-utils'

type ComposerFilePickerAttachmentsPanelProps = {
  attachments: ComposerAttachment[]
  className?: string
  draggedAttachments: ComposerAttachment[]
  dropActive: boolean
  browserUploadAvailable: boolean
  uploadingDeviceFiles: boolean
  onDragActiveChange: (active: boolean) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onPickDeviceFiles: () => void
  onRemoveAttachment: (attachmentPath: string) => void
}

function getOpenAttachmentIcon(attachment: ComposerAttachment) {
  if (isSafeExternalUrl(attachment.path)) {
    return <Globe size={11} className="block -translate-y-px" />
  }

  return attachment.kind === 'directory' ? (
    <Folder size={11} className="block -translate-y-px" />
  ) : (
    <File size={11} className="block -translate-y-px" />
  )
}

export function ComposerFilePickerAttachmentsPanel({
  attachments,
  className,
  draggedAttachments,
  dropActive,
  browserUploadAvailable,
  uploadingDeviceFiles,
  onDragActiveChange,
  onDrop,
  onPickDeviceFiles,
  onRemoveAttachment,
}: ComposerFilePickerAttachmentsPanelProps) {
  return (
    <section
      role="application"
      className={cn(
        'min-h-0 overflow-x-hidden overflow-y-auto border-r border-[color:var(--border)] py-2 pr-2 pl-2',
        dropActive && 'bg-[color:var(--surface-hover)]',
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        onDragActiveChange(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onDragActiveChange(false)
        }
      }}
      onDrop={onDrop}
    >
      <div className="grid min-h-full content-start gap-0 max-[520px]:min-h-0 max-[520px]:gap-1">
        {browserUploadAvailable ? (
          <button
            type="button"
            className={cn(
              'mb-2 inline-flex min-h-7 min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-60',
              appTypeTinyClass,
              appToneMutedClass,
            )}
            onClick={onPickDeviceFiles}
            disabled={uploadingDeviceFiles}
          >
            {uploadingDeviceFiles ? (
              <Loader2 size={11} className="shrink-0 animate-spin" />
            ) : (
              <Upload size={11} className="shrink-0" />
            )}
            <span className="truncate">{uploadingDeviceFiles ? 'Uploading…' : 'Device'}</span>
          </button>
        ) : null}
        {attachments.length > 0 ? (
          attachments.map((attachment) => (
            <div
              key={attachment.path}
              className={cn(
                'flex h-5 min-w-0 items-center gap-1 rounded-sm border border-transparent bg-transparent px-1.5 transition-colors hover:bg-[color:var(--surface-hover)]',
                appTypeTinyClass,
                appToneTextClass,
              )}
              title={attachment.path}
            >
              <button
                type="button"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded p-0 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                onClick={() => void openComposerAttachment(attachment)}
                aria-label={getOpenAttachmentLabel(attachment)}
              >
                {getOpenAttachmentIcon(attachment)}
              </button>
              <span className="min-w-0 flex-1 truncate">
                {getAttachmentDisplayLabel(attachment)}
              </span>
              <button
                type="button"
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded p-0 text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
                onClick={() => onRemoveAttachment(attachment.path)}
                aria-label={`Remove ${attachment.name}`}
              >
                <X size={11} className="block -translate-y-px" />
              </button>
            </div>
          ))
        ) : (
          <div
            className={cn(
              'grid min-h-24 place-items-center rounded-lg px-3 py-4 text-center transition-colors',
              appTypeTinyClass,
              appToneMutedClass,
              dropActive && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
          >
            {draggedAttachments.length > 0 ? 'Drop to attach' : 'No attachments yet.'}
          </div>
        )}
      </div>
    </section>
  )
}
