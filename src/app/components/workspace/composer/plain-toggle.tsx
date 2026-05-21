import { cn } from '../../../utils/cn'

type PlainToggleProps = {
  checked: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  toggleSide?: 'left' | 'right'
}

export function PlainToggle({
  checked,
  disabled = false,
  label,
  onClick,
  toggleSide = 'right',
}: PlainToggleProps) {
  const toggle = (
    <span
      className={cn(
        'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
        checked ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--surface-hover)]',
      )}
    >
      <span
        className={cn(
          'inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--accent-contrast)] transition-transform',
          checked ? 'translate-x-4' : 'translate-x-1',
        )}
      />
    </span>
  )

  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-7 items-center gap-2 rounded-md px-2 py-1 text-[11.5px] text-[color:var(--muted)] transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-45'
          : 'hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
    >
      {toggleSide === 'left' ? toggle : null}
      <span>{label}</span>
      {toggleSide === 'right' ? toggle : null}
    </button>
  )
}
