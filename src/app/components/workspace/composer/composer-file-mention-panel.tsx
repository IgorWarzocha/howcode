import { File, Folder } from 'lucide-react'
import type { RefObject } from 'react'
import { cn } from '../../../utils/cn'
import {
  type ComposerFileMentions,
  getComposerFileMentionOptionId,
} from './useComposerFileMentions'

function FileMentionOption({
  file,
  fileMentions,
  index,
  selected,
}: {
  file: ComposerFileMentions['files'][number]
  fileMentions: ComposerFileMentions
  index: number
  selected: boolean
}) {
  const Icon = file.kind === 'directory' ? Folder : File
  return (
    <button
      id={getComposerFileMentionOptionId(index)}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
        selected
          ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
      )}
      onPointerEnter={() => fileMentions.setSelectedIndex(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => fileMentions.selectFile(file)}
    >
      <Icon size={13} className="shrink-0 text-[color:var(--muted)]" />
      <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--text)]">
        {file.relativePath}
      </span>
    </button>
  )
}

export function ComposerFileMentionPanel({
  fileMentions,
  panelRef,
}: {
  fileMentions: ComposerFileMentions
  panelRef: RefObject<HTMLDivElement | null>
}) {
  if (!fileMentions.open) return null
  return (
    <div
      ref={panelRef}
      id={fileMentions.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer files"
      className={cn(
        'pointer-events-auto w-[26.5rem] max-w-[calc(100vw-2rem)] scroll-py-1.5 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-1.5 shadow-[var(--shadow)]',
        fileMentions.files.length > 10 && 'max-h-72 overflow-y-auto',
      )}
    >
      {fileMentions.files.length > 0 ? (
        fileMentions.files.map((file, index) => (
          <FileMentionOption
            key={file.path}
            file={file}
            fileMentions={fileMentions}
            index={index}
            selected={index === fileMentions.selectedIndex}
          />
        ))
      ) : (
        <div className="px-2 py-2 text-[12px] text-[color:var(--muted)]">
          {fileMentions.loading ? 'Finding files…' : 'No matching files'}
        </div>
      )}
    </div>
  )
}
