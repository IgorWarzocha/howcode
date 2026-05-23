import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ThreadSearchMatch } from '../desktop/types'
import { getTimelineRowMessageIds } from './thread-message-ids'
import type { TimelineRow } from './timeline-row'

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
  const [pendingFindScrollMessageId, setPendingFindScrollMessageId] = useState<string | null>(null)
  const findLoadAttemptsRef = useRef<Record<string, number>>({})

  const activeFindRowId = useMemo(() => {
    if (!activeFindMatch) return null
    return (
      rows.find((row) => getTimelineRowMessageIds(row).includes(activeFindMatch.messageId))?.id ??
      null
    )
  }, [activeFindMatch, rows])

  useEffect(() => {
    if (!activeFindMatch) return

    if (!activeFindRowId) {
      if (previousMessageCount <= 0) return
      const attempts = findLoadAttemptsRef.current[activeFindMatch.messageId] ?? 0
      if (attempts >= 20) return
      findLoadAttemptsRef.current[activeFindMatch.messageId] = attempts + 1
      onLoadAroundMessage?.(Number.MAX_SAFE_INTEGER)
      return
    }

    shouldStickToBottomRef.current = false
    setPendingFindScrollMessageId(activeFindMatch.messageId)
    setCollapsedRowIds((current) => {
      if (current[activeFindRowId] === false) return current
      return { ...current, [activeFindRowId]: false }
    })
  }, [
    activeFindMatch,
    activeFindRowId,
    onLoadAroundMessage,
    previousMessageCount,
    setCollapsedRowIds,
    shouldStickToBottomRef,
  ])

  useEffect(() => {
    void rowStructureSignature
    if (!pendingFindScrollMessageId) return

    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const exactMessage = [...container.querySelectorAll<HTMLElement>('[data-message-id]')].find(
        (element) => element.getAttribute('data-message-id') === pendingFindScrollMessageId,
      )
      const row =
        exactMessage ??
        [...container.querySelectorAll<HTMLElement>('[data-message-ids]')].find((element) =>
          (element.getAttribute('data-message-ids') ?? '')
            .split(' ')
            .includes(pendingFindScrollMessageId),
        )
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
      setPendingFindScrollMessageId(null)
      programmaticScrollFrameRef.current = window.requestAnimationFrame(() => {
        programmaticScrollFrameRef.current = null
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [containerRef, pendingFindScrollMessageId, programmaticScrollFrameRef, rowStructureSignature])

  const revealFindMatch = useCallback(
    (match: ThreadSearchMatch | null) => {
      setActiveFindMatch(match)
      if (!match) return
      findLoadAttemptsRef.current = { [match.messageId]: 0 }
      setPendingFindScrollMessageId(match.messageId)
      const matchingRow = rows.find((row) =>
        getTimelineRowMessageIds(row).includes(match.messageId),
      )
      if (!matchingRow) return
      shouldStickToBottomRef.current = false
      setCollapsedRowIds((current) => ({
        ...current,
        [matchingRow.id]: false,
      }))
    },
    [rows, setCollapsedRowIds, shouldStickToBottomRef],
  )

  return {
    activeFindMessageId: activeFindMatch?.messageId ?? null,
    activeFindRowId,
    findQuery,
    revealFindMatch,
    setFindQuery,
  }
}
