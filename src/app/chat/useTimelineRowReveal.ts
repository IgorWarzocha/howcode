import { useCallback, useEffect, useState } from 'react'

function findTimelineMessageElement(container: HTMLElement, messageId: string) {
  const exactMessage = [...container.querySelectorAll<HTMLElement>('[data-message-id]')].find(
    (element) => element.getAttribute('data-message-id') === messageId,
  )
  return (
    exactMessage ??
    [...container.querySelectorAll<HTMLElement>('[data-message-ids]')].find((element) =>
      new Set((element.getAttribute('data-message-ids') ?? '').split(' ')).has(messageId),
    )
  )
}

export function useTimelineRowReveal({
  containerRef,
  programmaticScrollFrameRef,
  rowStructureSignature,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  programmaticScrollFrameRef: React.MutableRefObject<number | null>
  rowStructureSignature: string
}) {
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null)

  useEffect(() => {
    void rowStructureSignature
    if (!pendingMessageId) return

    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const row = findTimelineMessageElement(container, pendingMessageId)
      if (!row) return

      if (programmaticScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(programmaticScrollFrameRef.current)
      }
      const containerRect = container.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      const topPadding = Math.min(120, Math.max(32, container.clientHeight * 0.18))
      container.scrollTo({
        top: container.scrollTop + rowRect.top - containerRect.top - topPadding,
        behavior: 'smooth',
      })
      setPendingMessageId(null)
      programmaticScrollFrameRef.current = window.requestAnimationFrame(() => {
        programmaticScrollFrameRef.current = null
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [containerRef, pendingMessageId, programmaticScrollFrameRef, rowStructureSignature])

  return useCallback((messageId: string) => setPendingMessageId(messageId), [])
}
