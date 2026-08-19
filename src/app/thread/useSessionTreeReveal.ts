import { useEffect, useMemo } from 'react'
import { howcodeSessionTreeRevealEvent, type SessionTreeRevealDetail } from './session-tree-reveal'
import { buildTimelineRowByMessageId } from './thread-message-ids'
import type { TimelineRow } from './timeline-row'
import { useTimelineRowReveal } from './useTimelineRowReveal'

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
  const rowByMessageId = useMemo(() => buildTimelineRowByMessageId(rows), [rows])
  const revealTimelineMessage = useTimelineRowReveal({
    containerRef,
    programmaticScrollFrameRef,
    rowStructureSignature,
  })

  useEffect(() => {
    const handleReveal = (event: Event) => {
      const detail = (event as CustomEvent<SessionTreeRevealDetail>).detail
      if (!detail?.entryId?.trim()) return
      const normalizedPath = sessionPath?.trim()
      if (!normalizedPath || detail.sessionPath.trim() !== normalizedPath) return

      shouldStickToBottomRef.current = false
      revealTimelineMessage(detail.entryId)

      const matchingRow = rowByMessageId.get(detail.entryId)
      if (!matchingRow) return

      setCollapsedRowIds((current) => {
        if (current[matchingRow.id] === false) return current
        return { ...current, [matchingRow.id]: false }
      })
    }

    window.addEventListener(howcodeSessionTreeRevealEvent, handleReveal)
    return () => window.removeEventListener(howcodeSessionTreeRevealEvent, handleReveal)
  }, [
    revealTimelineMessage,
    rowByMessageId,
    sessionPath,
    setCollapsedRowIds,
    shouldStickToBottomRef,
  ])
}
