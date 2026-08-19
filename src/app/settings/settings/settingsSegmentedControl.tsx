import type { ReactNode } from 'react'
import { appToneMutedClass, appTypeSmallClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

export type SettingsSegmentedOption<Value extends string> = {
  value: Value
  label: ReactNode
}

export function SettingsSegmentedControl<Value extends string>({
  buttonClassName,
  className,
  columnsClassName,
  onChange,
  options,
  value,
}: {
  buttonClassName?: string | undefined
  className?: string | undefined
  columnsClassName: string
  onChange: (value: Value) => void
  options: readonly SettingsSegmentedOption<Value>[]
  value: Value
}) {
  return (
    <div
      className={cn(
        'grid rounded-lg bg-[color:var(--surface-hover)] p-[3px]',
        appTypeSmallClass,
        appToneMutedClass,
        columnsClassName,
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-md px-2.5 py-1 transition-colors hover:bg-[color:var(--surface-hover)] active:scale-[0.98]',
            value === option.value &&
              'bg-[color:var(--folded-row-hover-bg)] text-[color:var(--text)]',
            buttonClassName,
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
