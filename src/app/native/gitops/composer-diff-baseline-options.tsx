import { Check } from 'lucide-react'
import type { ProjectCommitEntry } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeMetaClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

export function CommitOption({
  commit,
  selected,
  onSelect,
}: {
  commit: ProjectCommitEntry
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        composerPopoverOptionClass,
        'min-h-10 py-1.5',
        selected && composerPopoverOptionSelectedClass,
      )}
      onClick={onSelect}
      aria-label={`Select ${commit.subject || commit.shortSha}`}
      data-tooltip="Select baseline"
    >
      <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
        {selected ? <Check size={14} /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate', appTypeControlClass, appToneTextClass)}>
          {commit.subject || '(no subject)'}
        </span>
        <span className={cn('block truncate', appTypeMetaClass, appToneMutedClass)}>
          {commit.shortSha} · {commit.authorName}
        </span>
      </span>
    </button>
  )
}

export function BaselineOption({
  label,
  meta,
  selected,
  onSelect,
}: {
  label: string
  meta?: string | null | undefined
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        composerPopoverOptionClass,
        meta ? 'min-h-10 py-1.5' : 'min-h-8 py-1.5',
        selected && composerPopoverOptionSelectedClass,
      )}
      onClick={onSelect}
    >
      <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
        {selected ? <Check size={14} /> : null}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block truncate',
            appTypeControlClass,
            selected ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]',
          )}
        >
          {label}
        </span>
        {meta ? (
          <span className={cn('block truncate', appTypeMetaClass, appToneMutedClass)}>{meta}</span>
        ) : null}
      </span>
    </button>
  )
}
