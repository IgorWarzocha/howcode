import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { ThreadSearchMatch } from '../desktop/types'
import { buildTimelineRowByMessageId } from './thread-message-ids'
import type { TimelineRow } from './timeline-row'
import { useTimelineRowReveal } from './useTimelineRowReveal'

type ThreadFindNavigationInput = {
  containerRef: React.RefObject<HTMLDivElement | null>
  onLoadAroundMessage?: ((targetHistoryCompactions: number) => void) | undefined
  previousMessageCount: number
  programmaticScrollFrameRef: React.MutableRefObject<number | null>
  rowStructureSignature: string
  rows: TimelineRow[]
  setCollapsedRowIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  shouldStickToBottomRef: React.MutableRefObject<boolean>
}

export function useThreadFindNavigation({
  containerRef,
  onLoadAroundMessage,
  previousMessageCount,
  programmaticScrollFrameRef,
  rowStructureSignature,
  rows,
  setCollapsedRowIds,
  shouldStickToBottomRef,
}: ThreadFindNavigationInput) {
  const [activeFindMatch, setActiveFindMatch] = useState<ThreadSearchMatch | null>(null)
  const [findQuery, setFindQuery] = useState('')
  const findLoadAttemptsRef = useRef<Record<string, number>>({})
  const rowByMessageId = useMemo(() => buildTimelineRowByMessageId(rows), [rows])
  const revealTimelineMessage = useTimelineRowReveal({
    containerRef,
    programmaticScrollFrameRef,
    rowStructureSignature,
  })
  const loadAroundMessage = useEffectEvent((historyCompactions: number) =>
    onLoadAroundMessage?.(historyCompactions),
  )

  const activeFindRowId = useMemo(() => {
    if (!activeFindMatch) return null
    return rowByMessageId.get(activeFindMatch.messageId)?.id ?? null
  }, [activeFindMatch, rowByMessageId])

  useEffect(() => {
    if (!activeFindMatch) return

    if (!activeFindRowId) {
      if (previousMessageCount <= 0) return
      const attempts = findLoadAttemptsRef.current[activeFindMatch.messageId] ?? 0
      if (attempts >= 20) return
      findLoadAttemptsRef.current[activeFindMatch.messageId] = attempts + 1
      loadAroundMessage(activeFindMatch.revealHistoryCompactions ?? Number.MAX_SAFE_INTEGER)
      return
    }

    shouldStickToBottomRef.current = false
    revealTimelineMessage(activeFindMatch.messageId)
    setCollapsedRowIds((current) => {
      if (current[activeFindRowId] === false) return current
      return { ...current, [activeFindRowId]: false }
    })
  }, [
    activeFindMatch,
    activeFindRowId,
    previousMessageCount,
    revealTimelineMessage,
    setCollapsedRowIds,
    shouldStickToBottomRef,
  ])

  const revealFindMatch = useCallback(
    (match: ThreadSearchMatch | null) => {
      setActiveFindMatch(match)
      if (!match) return
      findLoadAttemptsRef.current = { [match.messageId]: 0 }
      revealTimelineMessage(match.messageId)
      const matchingRow = rowByMessageId.get(match.messageId)
      if (!matchingRow) return
      shouldStickToBottomRef.current = false
      setCollapsedRowIds((current) => ({
        ...current,
        [matchingRow.id]: false,
      }))
    },
    [revealTimelineMessage, rowByMessageId, setCollapsedRowIds, shouldStickToBottomRef],
  )

  return {
    activeFindMessageId: activeFindMatch?.messageId ?? null,
    activeFindRowId,
    findQuery,
    revealFindMatch,
    setFindQuery,
  }
}
