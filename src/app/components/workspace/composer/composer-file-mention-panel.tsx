import {
  appToneTextClass,
  appTypeSmallClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverPanelClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import { File, Folder } from 'lucide-react'
import type { RefObject } from 'react'
import { cn } from '../../../utils/cn'
import { PopoverPanel } from '../../common/popover'
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
        composerPopoverOptionClass,
        'flex min-h-8 py-1.5',
        selected
          ? composerPopoverOptionSelectedClass
          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
      )}
      onPointerEnter={() => fileMentions.setSelectedIndex(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => fileMentions.selectFile(file)}
    >
      <Icon size={13} className="shrink-0 text-[color:var(--muted)]" />
      <span className={cn('min-w-0 flex-1 truncate', appTypeSmallClass, appToneTextClass)}>
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
    <PopoverPanel
      surface={false}
      ref={panelRef}
      id={fileMentions.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer files"
      className={cn(
        composerPopoverPanelClass,
        'w-[26.5rem] max-w-[calc(100vw-2rem)]',
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
        <div className={inlineEmptyNoteClass}>
          {fileMentions.loading ? 'Finding files…' : 'No matching files'}
        </div>
      )}
    </PopoverPanel>
  )
}
