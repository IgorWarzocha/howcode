import { type ReactNode, type RefObject, useLayoutEffect, useState } from 'react'
import { measureTextareaMarkerPosition } from './composer-textarea-measurement'

type Position = { left: number; top: number }

export function useTrailingAdornmentPosition({
  lineHeightRef,
  placeholder,
  textareaLayoutVersion,
  textareaRef,
  trailingAdornmentVisible,
  value,
}: {
  lineHeightRef: React.MutableRefObject<number>
  placeholder: string
  textareaLayoutVersion: number
  textareaRef: RefObject<HTMLTextAreaElement | null>
  trailingAdornmentVisible: boolean
  value: string
}) {
  const [trailingAdornmentPosition, setTrailingAdornmentPosition] = useState<Position | null>(null)
  const [trailingContainerHeight, setTrailingContainerHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    void textareaLayoutVersion

    if (!trailingAdornmentVisible) {
      setTrailingAdornmentPosition(null)
      setTrailingContainerHeight(null)
      return
    }

    const textarea = textareaRef.current
    if (!textarea) return

    const measureTrailingAdornmentPosition = () => {
      if (value.length === 0) {
        const nextTop = 0
        const nextContainerHeight = textarea.offsetHeight
        const nextLeft = -5
        setTrailingAdornmentPosition((current) =>
          current?.left === nextLeft && current.top === nextTop
            ? current
            : { left: nextLeft, top: nextTop },
        )
        setTrailingContainerHeight((current) =>
          current === nextContainerHeight ? current : nextContainerHeight,
        )
        return
      }

      const markerPosition = measureTextareaMarkerPosition({
        adornmentWidth: 0,
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
      const rawTop = markerTop + (shouldWrapAdornment ? lineHeight : 0) - textarea.scrollTop - 1.5
      const maxVisibleTop = Math.max(0, textarea.clientHeight - lineHeight)
      const nextTop = Math.max(0, Math.min(rawTop, maxVisibleTop))
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
    textarea.addEventListener('scroll', measureTrailingAdornmentPosition, { passive: true })
    return () => {
      window.removeEventListener('resize', measureTrailingAdornmentPosition)
      textarea.removeEventListener('scroll', measureTrailingAdornmentPosition)
    }
  }, [
    lineHeightRef,
    placeholder,
    textareaLayoutVersion,
    textareaRef,
    trailingAdornmentVisible,
    value,
  ])

  return { trailingAdornmentPosition, trailingContainerHeight }
}

export function useInlinePopoverPosition({
  inlinePopover,
  inlinePopoverWrapperRef,
  placeholder,
  textareaRef,
  value,
}: {
  inlinePopover: ReactNode
  inlinePopoverWrapperRef: RefObject<HTMLDivElement | null>
  placeholder: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
}) {
  const [inlinePopoverPosition, setInlinePopoverPosition] = useState<Position | null>(null)

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
        adornmentWidth: 0,
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
  }, [inlinePopover, inlinePopoverWrapperRef, placeholder, textareaRef, value])

  return inlinePopoverPosition
}
