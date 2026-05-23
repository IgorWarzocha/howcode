import { Maximize2, Minimize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { appTypeBodyClass, appTypeSmallClass, compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

const PLACEHOLDER_SEPARATOR_PATTERN = / · | — |: /

function splitPlaceholderText(placeholder: string) {
  const separatorMatch = PLACEHOLDER_SEPARATOR_PATTERN.exec(placeholder)
  const separator = separatorMatch?.[0]
  const index = separatorMatch?.index ?? -1
  if (separator && index > 0) {
    const tailParts: string[] = []
    for (const part of placeholder.slice(index).split(separator)) {
      if (part) tailParts.push(`${separator}${part}`)
    }
    return {
      leading: placeholder.slice(0, index),
      tailParts,
    }
  }
  return { leading: placeholder, tailParts: [] }
}

export function ComposerResponsivePlaceholder({
  placeholder,
  tone,
  leadingAdornmentVisible = false,
  endAdornmentVisible = false,
}: {
  placeholder: string
  tone: 'muted' | 'error'
  leadingAdornmentVisible?: boolean
  endAdornmentVisible?: boolean
}) {
  if (!placeholder) return null
  const { leading, tailParts } = splitPlaceholderText(placeholder)
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 min-w-0 truncate',
        appTypeBodyClass,
        leadingAdornmentVisible && 'pl-6',
        endAdornmentVisible && 'composer-text-field-end-adornment-space',
        tone === 'error' ? 'text-[color:var(--danger)]' : 'text-[color:var(--muted-2)]',
      )}
    >
      <span>{leading}</span>
      {tailParts.map((part, index) => (
        <span
          key={part}
          className={cn(
            index === 0 && 'composer-placeholder-tail-md',
            index === 1 && 'composer-placeholder-tail-sm',
            index >= 2 && 'composer-placeholder-tail-xs',
          )}
        >
          {part}
        </span>
      ))}
    </div>
  )
}

export function ComposerStatusMessage({
  message,
  tone,
}: {
  message: string | null
  tone: 'error' | 'success'
}) {
  if (!message) return null
  return (
    <div
      className={cn(
        'truncate',
        appTypeSmallClass,
        tone === 'success' ? 'text-[color:var(--green)]' : 'text-[color:var(--danger)]',
      )}
    >
      {message}
    </div>
  )
}

export function ComposerExpandButton({
  canExpandField,
  fieldExpanded,
  setFieldExpanded,
}: {
  canExpandField: boolean
  fieldExpanded: boolean
  setFieldExpanded: React.Dispatch<React.SetStateAction<boolean>>
}) {
  if (!canExpandField) return null
  return (
    <div className="pointer-events-none absolute right-[-0.875rem] bottom-0 z-20 flex h-7 items-center justify-end">
      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          'composer-expand-button pointer-events-auto h-7 w-7 shrink-0',
        )}
        aria-label={fieldExpanded ? 'Collapse composer' : 'Expand composer'}
        aria-pressed={fieldExpanded}
        data-tooltip={fieldExpanded ? 'Collapse composer' : 'Expand composer'}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          setFieldExpanded((current) => !current)
        }}
      >
        {fieldExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
    </div>
  )
}

export function TrailingAdornment({
  lineHeight,
  position,
  trailingAdornment,
  visible,
}: {
  lineHeight: number
  position: { left: number; top: number } | null
  trailingAdornment: ReactNode
  visible: boolean
}) {
  if (!(trailingAdornment && position)) return null
  return (
    <span
      className={cn(
        'absolute z-10 inline-flex items-center',
        !visible && 'pointer-events-none invisible',
      )}
      style={{ left: `${position.left}px`, top: `${position.top}px`, height: `${lineHeight}px` }}
    >
      {trailingAdornment}
    </span>
  )
}
