import { appToneMutedClass, appTypeGroupTextClass } from '../ui/classes'
import { cn } from '../utils/cn'
import type { PiResourceInstallScope } from './types'

const installScopeOptions: ReadonlyArray<{
  value: PiResourceInstallScope
  label: string
}> = [
  { value: 'global', label: 'Global' },
  { value: 'project', label: 'Project' },
  { value: 'chat', label: 'Chat' },
]

export function PiResourceScopeSwitcher({
  label,
  value,
  counts,
  onChange,
}: {
  label: string
  value: PiResourceInstallScope
  counts: Record<PiResourceInstallScope, number>
  onChange: (scope: PiResourceInstallScope) => void
}) {
  return (
    <fieldset className="m-0 flex min-w-0 items-center gap-1 border-0 p-0">
      <legend className="sr-only">{label} install scope</legend>
      {installScopeOptions.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              `rounded-md px-2 py-0.5 ${appTypeGroupTextClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`,
              selected && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label} {counts[option.value]}
          </button>
        )
      })}
    </fieldset>
  )
}
