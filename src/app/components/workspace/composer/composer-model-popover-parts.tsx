import { Check } from 'lucide-react'
import type { ComposerThinkingLevel } from '../../../desktop/types'
import { menuOptionClass, toolbarButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

export type NestedModelMenu = 'provider' | 'model' | 'thinking' | null

export type ComposerModelMenuOption = {
  id: string
  label: string
  description?: string
  selected: boolean
  onSelect: () => void
}

export function ModelPopoverTriggerButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        toolbarButtonClass,
        'grid min-h-8 w-full grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[color:var(--surface-hover)]',
        active && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
      )}
      onClick={onClick}
    >
      <span className="text-[10.5px] tracking-[0.06em] text-[color:var(--muted-2)] uppercase">
        {label}
      </span>
      <span
        className={cn(
          'min-w-0 truncate text-[11.5px]',
          active ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]',
        )}
      >
        {value}
      </span>
    </button>
  )
}

export function ModelPopoverMenuList({ items }: { items: ComposerModelMenuOption[] }) {
  return (
    <div
      role="menu"
      className={cn('-mx-1.5 -mt-1.5 pr-0', items.length > 10 && 'max-h-72 overflow-y-auto')}
    >
      <div className="grid min-w-0 pl-1 pt-1.5 pr-0 pb-2.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitemradio"
            aria-checked={item.selected}
            className={cn(
              menuOptionClass,
              'mr-1 min-h-8 rounded-lg py-1.5 text-[11.5px] text-[color:var(--muted)] hover:text-[color:var(--text)]',
              item.selected && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
            onClick={item.onSelect}
          >
            <span className="inline-flex items-center justify-center text-[color:var(--accent)]">
              {item.selected ? <Check size={13} /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              {item.description ? (
                <span
                  className={cn(
                    'block truncate text-[10px]',
                    item.selected ? 'text-[color:var(--muted)]' : 'text-[color:var(--muted-2)]',
                  )}
                >
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export type ThinkingLevelLabels = Record<ComposerThinkingLevel, string>
