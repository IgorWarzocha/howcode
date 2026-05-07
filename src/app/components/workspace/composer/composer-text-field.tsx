import { Maximize2, Minimize2 } from 'lucide-react'
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useHoverToFocus } from '../../../hooks/useHoverToFocus'
import { compactIconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

const COLLAPSED_VISIBLE_LINE_COUNT = 5
const EXPANDED_VISIBLE_LINE_COUNT = 15

type ComposerTextFieldProps = {
  value: string
  placeholder: string
  placeholderTone?: 'muted' | 'error'
  statusMessage?: string | null
  statusTone?: 'error' | 'success'
  ariaLabel: string
  ariaActiveDescendant?: string | undefined
  ariaControls?: string | undefined
  reservedLineCount?: number
  inlinePopover?: ReactNode
  trailingAdornment?: ReactNode
  readOnly?: boolean
  hoverToFocus?: boolean
  hoverToBlur?: boolean
  hoverBoundaryRef?: RefObject<HTMLElement | null> | undefined
  onHeightChange?: ((height: number) => void) | undefined
  onChange: (value: string) => void
  onInput?: (() => void) | undefined
  onKeyDown?: ((event: KeyboardEvent<HTMLTextAreaElement>) => void) | undefined
  onPaste?: ((event: ClipboardEvent<HTMLTextAreaElement>) => void) | undefined
  onFocus?: (() => void) | undefined
  onBlur?: (() => void) | undefined
  onExpandedChange?: ((expanded: boolean) => void) | undefined
}

function updateComposerTextareaHeight(input: {
  fieldExpanded: boolean
  lastReportedHeightRef: React.MutableRefObject<number | null>
  lineHeightRef: React.MutableRefObject<number>
  onExpandedChange: ((expanded: boolean) => void) | undefined
  onHeightChange: ((height: number) => void) | undefined
  reservedHeight: number | null
  reservedLineCount: number
  setCanExpandField: React.Dispatch<React.SetStateAction<boolean>>
  setFieldExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setReservedHeight: React.Dispatch<React.SetStateAction<number | null>>
  textarea: HTMLTextAreaElement
  value: string
  wrapperRef: React.RefObject<HTMLDivElement | null>
}) {
  const computedStyle = window.getComputedStyle(input.textarea)
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20
  input.lineHeightRef.current = lineHeight
  const nextReservedHeight = Math.ceil(lineHeight * input.reservedLineCount)
  input.setReservedHeight((current) =>
    current === nextReservedHeight ? current : nextReservedHeight,
  )
  const maxVisibleLineCount = input.fieldExpanded
    ? EXPANDED_VISIBLE_LINE_COUNT
    : COLLAPSED_VISIBLE_LINE_COUNT
  const maxVisibleHeight = Math.ceil(lineHeight * maxVisibleLineCount)
  input.textarea.style.height = '0px'
  const scrollHeight = Math.max(input.textarea.scrollHeight, 24)
  const nextHeight = Math.min(scrollHeight, Math.max(maxVisibleHeight, 24))
  input.textarea.style.height = `${nextHeight}px`
  input.textarea.style.overflowY = scrollHeight > nextHeight + 1 ? 'auto' : 'hidden'
  const nextCanExpandField = scrollHeight > Math.ceil(lineHeight * COLLAPSED_VISIBLE_LINE_COUNT) + 1
  input.setCanExpandField((current) =>
    current === nextCanExpandField ? current : nextCanExpandField,
  )
  if (!nextCanExpandField && input.fieldExpanded) input.setFieldExpanded(false)
  window.requestAnimationFrame(() => {
    const reportedHeight = input.wrapperRef.current?.getBoundingClientRect().height ?? nextHeight
    if (input.lastReportedHeightRef.current === reportedHeight) return
    input.lastReportedHeightRef.current = reportedHeight
    input.onHeightChange?.(reportedHeight)
  })
  input.onExpandedChange?.(nextHeight > (input.reservedHeight ?? 0) + 1)
  if (input.value.length === 0) input.textarea.scrollTop = 0
}

function ComposerStatusMessage({
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
        'truncate text-[12px] leading-4',
        tone === 'success' ? 'text-[color:var(--green)]' : 'text-[color:var(--danger)]',
      )}
    >
      {message}
    </div>
  )
}

function ComposerExpandButton({
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

function TrailingAdornment({
  lineHeight,
  position,
  trailingAdornment,
}: {
  lineHeight: number
  position: { left: number; top: number } | null
  trailingAdornment: ReactNode
}) {
  if (!(trailingAdornment && position)) return null
  return (
    <span
      className="absolute z-10 inline-flex items-center"
      style={{ left: `${position.left}px`, top: `${position.top}px`, height: `${lineHeight}px` }}
    >
      {trailingAdornment}
    </span>
  )
}

function measureTextareaMarkerPosition(input: {
  markerText: string
  placeholder: string
  textarea: HTMLTextAreaElement
}) {
  const computedStyle = window.getComputedStyle(input.textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.wordBreak = 'break-word'
  mirror.style.boxSizing = computedStyle.boxSizing
  mirror.style.width = `${input.textarea.clientWidth}px`
  mirror.style.font = computedStyle.font
  mirror.style.fontFamily = computedStyle.fontFamily
  mirror.style.fontSize = computedStyle.fontSize
  mirror.style.fontWeight = computedStyle.fontWeight
  mirror.style.letterSpacing = computedStyle.letterSpacing
  mirror.style.lineHeight = computedStyle.lineHeight
  mirror.style.padding = computedStyle.padding
  mirror.style.border = computedStyle.border

  mirror.textContent = input.markerText || input.placeholder || ''
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  document.body.removeChild(mirror)

  return {
    left: Math.max(0, markerRect.left - mirrorRect.left),
    lineHeight,
    top: Math.max(0, markerRect.top - mirrorRect.top),
  }
}

export function ComposerTextField({
  value,
  placeholder,
  placeholderTone = 'muted',
  statusMessage = null,
  statusTone = 'error',
  ariaLabel,
  ariaActiveDescendant,
  ariaControls,
  reservedLineCount = 4,
  inlinePopover = null,
  trailingAdornment = null,
  readOnly = false,
  hoverToFocus = true,
  hoverToBlur = false,
  hoverBoundaryRef,
  onHeightChange,
  onChange,
  onInput,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  onExpandedChange,
}: ComposerTextFieldProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inlinePopoverWrapperRef = useRef<HTMLDivElement>(null)
  const lastReportedHeightRef = useRef<number | null>(null)
  const [reservedHeight, setReservedHeight] = useState<number | null>(null)
  const [trailingAdornmentPosition, setTrailingAdornmentPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const [inlinePopoverPosition, setInlinePopoverPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const [trailingContainerHeight, setTrailingContainerHeight] = useState<number | null>(null)
  const [fieldExpanded, setFieldExpanded] = useState(false)
  const [canExpandField, setCanExpandField] = useState(false)
  const lineHeightRef = useRef(20)

  const focusTextareaAtEnd = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.focus()
    const cursorPosition = textarea.value.length
    textarea.setSelectionRange(cursorPosition, cursorPosition)
  }, [])
  const handleHoverToFocus = useHoverToFocus({
    enabled: hoverToFocus,
    boundaryRef: hoverBoundaryRef ?? wrapperRef,
    targetRef: textareaRef,
    focus: focusTextareaAtEnd,
    blur: () => textareaRef.current?.blur(),
    blurOnLeave: hoverToBlur,
  })

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    updateComposerTextareaHeight({
      fieldExpanded,
      lastReportedHeightRef,
      lineHeightRef,
      onExpandedChange,
      onHeightChange,
      reservedHeight,
      reservedLineCount,
      setCanExpandField,
      setFieldExpanded,
      setReservedHeight,
      textarea,
      value,
      wrapperRef,
    })
  }, [fieldExpanded, onExpandedChange, onHeightChange, reservedHeight, reservedLineCount, value])

  useEffect(() => {
    const height = wrapperRef.current?.getBoundingClientRect().height
    if (!height || lastReportedHeightRef.current === height) {
      return
    }

    lastReportedHeightRef.current = height
    onHeightChange?.(height)
  })

  useLayoutEffect(() => {
    if (!trailingAdornment) {
      setTrailingAdornmentPosition(null)
      setTrailingContainerHeight(null)
      return
    }

    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const measureTrailingAdornmentPosition = () => {
      const markerPosition = measureTextareaMarkerPosition({
        markerText: value,
        placeholder,
        textarea,
      })
      const markerLeft = markerPosition.left
      const markerTop = markerPosition.top
      const lineHeight = markerPosition.lineHeight || lineHeightRef.current
      const adornmentWidth = 24
      const adornmentGap = 6
      const shouldWrapAdornment = markerLeft + adornmentGap + adornmentWidth > textarea.clientWidth
      const nextLeft = shouldWrapAdornment ? 0 : markerLeft + adornmentGap
      const nextTop = Math.max(0, markerTop + (shouldWrapAdornment ? lineHeight : 0) - 1.5)
      const canGrowForAdornment = textarea.scrollHeight <= textarea.offsetHeight + 1
      const maxContainerHeight = textarea.offsetHeight + (canGrowForAdornment ? lineHeight : 0)
      const nextContainerHeight = Math.min(
        maxContainerHeight,
        Math.max(textarea.offsetHeight, nextTop + lineHeight),
      )

      setTrailingAdornmentPosition((current) =>
        current?.left === nextLeft && current.top === nextTop
          ? current
          : { left: nextLeft, top: nextTop },
      )
      setTrailingContainerHeight((current) =>
        current === nextContainerHeight ? current : nextContainerHeight,
      )
    }

    measureTrailingAdornmentPosition()
    window.addEventListener('resize', measureTrailingAdornmentPosition)
    return () => window.removeEventListener('resize', measureTrailingAdornmentPosition)
  }, [placeholder, trailingAdornment, value])

  useLayoutEffect(() => {
    if (!inlinePopover) {
      setInlinePopoverPosition(null)
      return
    }

    const textarea = textareaRef.current
    if (!textarea) return

    const measureInlinePopoverPosition = () => {
      const cursorPosition = textarea.selectionStart ?? value.length
      const markerPosition = measureTextareaMarkerPosition({
        markerText: value.slice(0, cursorPosition),
        placeholder,
        textarea,
      })
      const textareaRect = textarea.getBoundingClientRect()
      const popoverHeight = inlinePopoverWrapperRef.current?.getBoundingClientRect().height ?? 288
      const popoverWidth = 320
      const gap = 8
      const nextLeft = Math.max(
        12,
        Math.min(
          window.innerWidth - popoverWidth - 12,
          textareaRect.left + markerPosition.left + gap,
        ),
      )
      const preferredTop =
        textareaRect.top +
        markerPosition.top -
        textarea.scrollTop +
        markerPosition.lineHeight / 2 -
        popoverHeight / 2
      const nextTop = Math.min(window.innerHeight - popoverHeight - 12, Math.max(12, preferredTop))
      setInlinePopoverPosition((current) =>
        current?.left === nextLeft && current.top === nextTop
          ? current
          : { left: nextLeft, top: nextTop },
      )
    }

    measureInlinePopoverPosition()
    window.addEventListener('resize', measureInlinePopoverPosition)
    textarea.addEventListener('keyup', measureInlinePopoverPosition)
    textarea.addEventListener('click', measureInlinePopoverPosition)
    textarea.addEventListener('input', measureInlinePopoverPosition)
    return () => {
      window.removeEventListener('resize', measureInlinePopoverPosition)
      textarea.removeEventListener('keyup', measureInlinePopoverPosition)
      textarea.removeEventListener('click', measureInlinePopoverPosition)
      textarea.removeEventListener('input', measureInlinePopoverPosition)
    }
  }, [inlinePopover, placeholder, value])

  const inlinePopoverElement =
    inlinePopover && inlinePopoverPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={inlinePopoverWrapperRef}
            className="pointer-events-none fixed z-[120]"
            style={{
              left: `${inlinePopoverPosition.left}px`,
              top: `${inlinePopoverPosition.top}px`,
            }}
          >
            {inlinePopover}
          </div>,
          document.body,
        )
      : null

  return (
    <div
      ref={wrapperRef}
      className="grid min-w-0 gap-1"
      style={reservedHeight ? { minHeight: `${reservedHeight}px` } : undefined}
      onPointerEnter={handleHoverToFocus}
      onPointerDown={(event) => {
        if (event.target === textareaRef.current) {
          return
        }

        event.preventDefault()
        focusTextareaAtEnd()
      }}
    >
      <ComposerStatusMessage message={statusMessage} tone={statusTone} />
      <div
        className="relative min-w-0"
        style={trailingContainerHeight ? { minHeight: `${trailingContainerHeight}px` } : undefined}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          className={cn(
            'm-0 w-full min-h-6 resize-none bg-transparent p-0 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none transition-opacity duration-150 [scrollbar-gutter:stable]',
            canExpandField &&
              'composer-textarea-scroll-above-button relative left-[0.25rem] w-[calc(100%-0.25rem)]',
            readOnly && 'cursor-wait opacity-45',
            placeholderTone === 'error'
              ? 'placeholder:text-[color:var(--danger)]'
              : 'placeholder:text-[color:var(--muted-2)]',
          )}
          value={value}
          onChange={(event) => {
            if (!readOnly) onChange(event.target.value)
          }}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-label={ariaLabel}
          aria-activedescendant={ariaActiveDescendant}
          aria-autocomplete={ariaControls ? 'list' : undefined}
          aria-controls={ariaControls}
          placeholder={placeholder}
          readOnly={readOnly}
        />
        <ComposerExpandButton
          canExpandField={canExpandField}
          fieldExpanded={fieldExpanded}
          setFieldExpanded={setFieldExpanded}
        />
        {inlinePopoverElement}
        <TrailingAdornment
          lineHeight={lineHeightRef.current}
          position={trailingAdornmentPosition}
          trailingAdornment={trailingAdornment}
        />
      </div>
    </div>
  )
}
