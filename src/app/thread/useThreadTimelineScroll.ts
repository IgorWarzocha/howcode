import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX, isScrollContainerNearBottom } from './chat-scroll'

export function useThreadTimelineScroll({
  bottomAnchorKey,
  composerLayoutVersion,
  composerOverlayHeight,
  containerRef,
  contentRef,
  programmaticScrollFrameRef,
  rowCount,
  rowStructureSignature,
  shouldStickToBottomRef,
}: {
  bottomAnchorKey: string
  composerLayoutVersion: number
  composerOverlayHeight: number
  containerRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  programmaticScrollFrameRef: React.MutableRefObject<number | null>
  rowCount: number
  rowStructureSignature: string
  shouldStickToBottomRef: React.MutableRefObject<boolean>
}) {
  const [nearBottom, setNearBottom] = useState(true)
  const pendingHistoryPrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (programmaticScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(programmaticScrollFrameRef.current)
    }
    container.scrollTop = container.scrollHeight
    shouldStickToBottomRef.current = true
    setNearBottom(true)
    programmaticScrollFrameRef.current = window.requestAnimationFrame(() => {
      programmaticScrollFrameRef.current = null
    })
  }, [containerRef, programmaticScrollFrameRef, shouldStickToBottomRef])

  useEffect(
    () => () => {
      if (programmaticScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(programmaticScrollFrameRef.current)
      }
    },
    [programmaticScrollFrameRef],
  )

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!(container && content) || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (shouldStickToBottomRef.current) scrollToBottom()
    })
    observer.observe(container)
    observer.observe(content)
    return () => observer.disconnect()
  }, [containerRef, contentRef, scrollToBottom, shouldStickToBottomRef])

  useLayoutEffect(() => {
    void bottomAnchorKey
    void composerLayoutVersion
    void composerOverlayHeight
    void rowStructureSignature
    const container = containerRef.current
    if (!container) return

    const pendingHistoryPrepend = pendingHistoryPrependRef.current
    if (pendingHistoryPrepend) {
      const delta = container.scrollHeight - pendingHistoryPrepend.scrollHeight
      container.scrollTop = pendingHistoryPrepend.scrollTop + Math.max(0, delta)
      pendingHistoryPrependRef.current = null
      return
    }
    if (rowCount > 0 && shouldStickToBottomRef.current) scrollToBottom()
  }, [
    bottomAnchorKey,
    composerLayoutVersion,
    composerOverlayHeight,
    containerRef,
    rowCount,
    rowStructureSignature,
    scrollToBottom,
    shouldStickToBottomRef,
  ])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || programmaticScrollFrameRef.current !== null) return
    const nextNearBottom = isScrollContainerNearBottom(
      {
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
      },
      CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
    )
    shouldStickToBottomRef.current = nextNearBottom
    setNearBottom(nextNearBottom)
  }, [containerRef, programmaticScrollFrameRef, shouldStickToBottomRef])

  const stopFollowingBottom = useCallback(() => {
    shouldStickToBottomRef.current = false
  }, [shouldStickToBottomRef])

  const prepareForHistoryPrepend = useCallback(() => {
    const container = containerRef.current
    if (container) {
      pendingHistoryPrependRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      }
    }
    shouldStickToBottomRef.current = false
  }, [containerRef, shouldStickToBottomRef])

  return {
    handleScroll,
    nearBottom,
    prepareForHistoryPrepend,
    scrollToBottom,
    stopFollowingBottom,
  }
}
