import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useHoverToFocus } from '../hooks/useHoverToFocus'
import { appToneTextClass, appTypeBodyClass } from '../ui/classes'
import { cn } from '../utils/cn'
import {
  ComposerExpandButton,
  ComposerResponsivePlaceholder,
  ComposerStatusMessage,
  TrailingAdornment,
} from './composer-text-field-parts'
import {
  isTextareaScrolledToBottom,
  useComposerTextareaHeight,
} from './composer-textarea-measurement'
import {
  useInlinePopoverPosition,
  useTrailingAdornmentPosition,
} from './useComposerTextFieldPositions'

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
  endAdornment?: ReactNode
  trailingAdornment?: ReactNode
  trailingAdornmentEnabled?: boolean
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
  endAdornment = null,
  trailingAdornment = null,
  trailingAdornmentEnabled = Boolean(trailingAdornment),
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
  const [fieldExpanded, setFieldExpanded] = useState(false)
  const lineHeightRef = useRef(20)
  const trailingAdornmentVisible = trailingAdornmentEnabled
  const endAdornmentVisible = Boolean(endAdornment)

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
    extraBoundaryRefs: [inlinePopoverWrapperRef],
  })

  const { canExpandField, reservedHeight, setTextareaLayoutVersion, textareaLayoutVersion } =
    useComposerTextareaHeight({
      fieldExpanded,
      lastReportedHeightRef,
      lineHeightRef,
      onExpandedChange,
      onHeightChange,
      reservedLineCount,
      setFieldExpanded,
      textareaRef,
      value,
      wrapperRef,
    })
  const { trailingAdornmentPosition, trailingContainerHeight } = useTrailingAdornmentPosition({
    lineHeightRef,
    placeholder,
    textareaLayoutVersion,
    textareaRef,
    trailingAdornmentVisible,
    value,
  })
  const inlinePopoverPosition = useInlinePopoverPosition({
    inlinePopover,
    inlinePopoverWrapperRef,
    placeholder,
    textareaRef,
    value,
  })

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
        {value.length === 0 ? (
          <ComposerResponsivePlaceholder
            placeholder={placeholder}
            tone={placeholderTone}
            leadingAdornmentVisible={trailingAdornmentVisible}
            endAdornmentVisible={endAdornmentVisible}
          />
        ) : null}
        {endAdornment ? (
          <div className="pointer-events-none absolute top-0 right-0 z-10 flex h-6 max-w-[45cqw] items-center justify-end">
            {endAdornment}
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          rows={1}
          className={cn(
            'm-0 w-full min-h-6 resize-none bg-transparent p-0 outline-none transition-opacity duration-150 [scrollbar-gutter:stable]',
            appTypeBodyClass,
            appToneTextClass,
            'overflow-x-hidden [hyphens:auto] [overflow-wrap:break-word] [word-break:normal]',
            trailingAdornmentVisible && value.length === 0 && 'pl-6',
            endAdornmentVisible && 'composer-text-field-end-adornment-space',
            canExpandField && 'composer-textarea-scroll-above-button',
            readOnly && 'cursor-wait opacity-45',
            'placeholder:text-transparent',
          )}
          value={value}
          onChange={(event) => {
            if (!readOnly) onChange(event.target.value)
          }}
          onInput={() => {
            if (textareaRef.current && isTextareaScrolledToBottom(textareaRef.current)) {
              setTextareaLayoutVersion((current) => current + 1)
            }
            onInput?.()
          }}
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
          visible={trailingAdornmentVisible}
        />
      </div>
    </div>
  )
}
