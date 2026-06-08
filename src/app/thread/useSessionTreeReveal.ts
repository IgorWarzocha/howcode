import { useEffect, useState } from 'react'
import { howcodeSessionTreeRevealEvent, type SessionTreeRevealDetail } from './session-tree-reveal'
import { getTimelineRowMessageIds } from './thread-message-ids'
import type { TimelineRow } from './timeline-row'

type UseSessionTreeRevealInput = {
  containerRef: React.RefObject<HTMLDivElement | null>
  programmaticScrollFrameRef: React.MutableRefObject<number | null>
  rowStructureSignature: string
  rows: TimelineRow[]
  sessionPath?: string | null | undefined
  setCollapsedRowIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  shouldStickToBottomRef: React.MutableRefObject<boolean>
}

export function useSessionTreeReveal({
  containerRef,
  programmaticScrollFrameRef,
  rowStructureSignature,
  rows,
  sessionPath,
  setCollapsedRowIds,
  shouldStickToBottomRef,
}: UseSessionTreeRevealInput) {
  const [pendingScrollEntryId, setPendingScrollEntryId] = useState<string | null>(null)

  useEffect(() => {
    const handleReveal = (event: Event) => {
      const detail = (event as CustomEvent<SessionTreeRevealDetail>).detail
      if (!detail?.entryId?.trim()) return
      const normalizedPath = sessionPath?.trim()
      if (!normalizedPath || detail.sessionPath.trim() !== normalizedPath) return

      shouldStickToBottomRef.current = false
      setPendingScrollEntryId(detail.entryId)

      const matchingRow = rows.find((row) => getTimelineRowMessageIds(row).includes(detail.entryId))
      if (!matchingRow) return

      setCollapsedRowIds((current) => {
        if (current[matchingRow.id] === false) return current
        return { ...current, [matchingRow.id]: false }
      })
    }

    window.addEventListener(howcodeSessionTreeRevealEvent, handleReveal)
    return () => window.removeEventListener(howcodeSessionTreeRevealEvent, handleReveal)
  }, [rows, sessionPath, setCollapsedRowIds, shouldStickToBottomRef])

  useEffect(() => {
    void rowStructureSignature
    if (!pendingScrollEntryId) return

    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return

      const targetId = pendingScrollEntryId
      const exactMessage = [...container.querySelectorAll<HTMLElement>('[data-message-id]')].find(
        (element) => element.getAttribute('data-message-id') === targetId,
      )
      const rowElement =
        exactMessage ??
        [...container.querySelectorAll<HTMLElement>('[data-message-ids]')].find((element) =>
          (element.getAttribute('data-message-ids') ?? '').split(' ').includes(targetId),
        )
      if (!rowElement) return

      if (programmaticScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(programmaticScrollFrameRef.current)
      }

      const containerRect = container.getBoundingClientRect()
      const rowRect = rowElement.getBoundingClientRect()
      const topPadding = Math.min(120, Math.max(32, container.clientHeight * 0.18))
      container.scrollTo({
        top: container.scrollTop + rowRect.top - containerRect.top - topPadding,
        behavior: 'smooth',
      })
      setPendingScrollEntryId(null)
      programmaticScrollFrameRef.current = window.requestAnimationFrame(() => {
        programmaticScrollFrameRef.current = null
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [containerRef, pendingScrollEntryId, programmaticScrollFrameRef, rowStructureSignature])
}
