import { useEffect, useLayoutEffect, useState } from 'react'

const COLLAPSED_VISIBLE_LINE_COUNT = 5
const EXPANDED_VISIBLE_LINE_COUNT = 15

export function measureTextareaMarkerPosition(input: {
  adornmentWidth: number
  markerText: string
  placeholder: string
  textarea: HTMLTextAreaElement
}) {
  const computedStyle = window.getComputedStyle(input.textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20

  Object.assign(mirror.style, {
    border: computedStyle.border,
    boxSizing: computedStyle.boxSizing,
    font: computedStyle.font,
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
    letterSpacing: computedStyle.letterSpacing,
    lineHeight: computedStyle.lineHeight,
    overflowWrap: 'break-word',
    padding: computedStyle.padding,
    pointerEvents: 'none',
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    width: `${Math.max(1, input.textarea.clientWidth - input.adornmentWidth)}px`,
    wordBreak: 'break-word',
  })

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

export function isTextareaScrolledToBottom(textarea: HTMLTextAreaElement) {
  return textarea.scrollHeight - textarea.scrollTop - textarea.clientHeight <= 1
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
  Object.assign(input.textarea.style, {
    height: `${nextHeight}px`,
    overflowY: scrollHeight > nextHeight + 1 ? 'auto' : 'hidden',
  })
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

export function useComposerTextareaHeight(input: {
  fieldExpanded: boolean
  lastReportedHeightRef: React.MutableRefObject<number | null>
  lineHeightRef: React.MutableRefObject<number>
  onExpandedChange: ((expanded: boolean) => void) | undefined
  onHeightChange: ((height: number) => void) | undefined
  reservedLineCount: number
  setFieldExpanded: React.Dispatch<React.SetStateAction<boolean>>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  wrapperRef: React.RefObject<HTMLDivElement | null>
}) {
  const [reservedHeight, setReservedHeight] = useState<number | null>(null)
  const [textareaLayoutVersion, setTextareaLayoutVersion] = useState(0)
  const [canExpandField, setCanExpandField] = useState(false)

  useLayoutEffect(() => {
    void textareaLayoutVersion
    const textarea = input.textareaRef.current
    if (!textarea) return
    updateComposerTextareaHeight({
      fieldExpanded: input.fieldExpanded,
      lastReportedHeightRef: input.lastReportedHeightRef,
      lineHeightRef: input.lineHeightRef,
      onExpandedChange: input.onExpandedChange,
      onHeightChange: input.onHeightChange,
      reservedHeight,
      reservedLineCount: input.reservedLineCount,
      setCanExpandField,
      setFieldExpanded: input.setFieldExpanded,
      setReservedHeight,
      textarea,
      value: input.value,
      wrapperRef: input.wrapperRef,
    })
  }, [
    input,
    input.fieldExpanded,
    input.onExpandedChange,
    input.onHeightChange,
    input.reservedLineCount,
    input.value,
    reservedHeight,
    textareaLayoutVersion,
  ])

  useEffect(() => {
    const height = input.wrapperRef.current?.getBoundingClientRect().height
    if (!height || input.lastReportedHeightRef.current === height) return
    input.lastReportedHeightRef.current = height
    input.onHeightChange?.(height)
  })

  useLayoutEffect(() => {
    const textarea = input.textareaRef.current
    if (!textarea) return
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      setTextareaLayoutVersion((current) => current + 1)
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [input.textareaRef])

  return { canExpandField, reservedHeight, setTextareaLayoutVersion, textareaLayoutVersion }
}
