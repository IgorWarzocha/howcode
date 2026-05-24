import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanUserErrorMessage } from '../desktop/error-messages'
import type { DesktopEvent, ProjectDiffBaseline, ProjectDiffResult } from '../desktop/types'
import {
  cancelProjectDiffStreamQuery,
  canStartProjectDiffStreamQuery,
  startProjectDiffStreamQuery,
  subscribeDesktopEvents,
} from '../query/desktop-query'
import { useProjectDiffInvalidationVersion } from './project-diff-invalidation'

type DiffState = {
  diff: ProjectDiffResult | null
  streamedPatch: string | null
  isLoading: boolean
  error: string | null
}

export function getReadableDesktopDiffError(error: string | null) {
  return error ? cleanUserErrorMessage(error, 'Could not load diff.') : null
}

function isProjectDiffStreamEvent(
  event: DesktopEvent,
): event is Extract<DesktopEvent, { type: 'project-diff-stream' }> {
  return event.type === 'project-diff-stream'
}

function createProjectDiffStreamId() {
  return window.crypto?.randomUUID?.() ?? `project-diff-${Date.now()}-${Math.random()}`
}

function useProjectDiffStream(
  projectId: string | null,
  baseline: ProjectDiffBaseline | null,
  enabled: boolean,
  includeUntracked: boolean,
  refreshVersion: number,
) {
  const [streamedPatch, setStreamedPatch] = useState<string | null>(null)
  const [diff, setDiff] = useState<ProjectDiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const pendingChunksRef = useRef(new Map<number, string>())
  const nextSequenceRef = useRef(0)
  const flushFrameRef = useRef<number | null>(null)
  const canStream = enabled && Boolean(projectId) && canStartProjectDiffStreamQuery()

  useEffect(() => {
    void refreshVersion
    const cancelChunkFlush = () => {
      if (flushFrameRef.current === null) return
      window.cancelAnimationFrame(flushFrameRef.current)
      flushFrameRef.current = null
    }

    const resetStreamState = () => {
      setStreamedPatch(null)
      setDiff(null)
      setError(null)
      setIsLoading(false)
      pendingChunksRef.current.clear()
      nextSequenceRef.current = 0
      cancelChunkFlush()
    }

    if (!(canStream && projectId)) {
      resetStreamState()
      return
    }

    let active = true
    const streamId = createProjectDiffStreamId()
    setStreamedPatch('')
    setDiff(null)
    setError(null)
    setIsLoading(true)
    pendingChunksRef.current.clear()
    nextSequenceRef.current = 0
    cancelChunkFlush()

    const appendPatchChunk = (chunk: string) => {
      setStreamedPatch((current) => `${current ?? ''}${chunk}`)
    }

    const flushPendingChunks = () => {
      flushFrameRef.current = null
      let nextSequence = nextSequenceRef.current
      let appendedPatch = ''
      while (pendingChunksRef.current.has(nextSequence)) {
        appendedPatch += pendingChunksRef.current.get(nextSequence) ?? ''
        pendingChunksRef.current.delete(nextSequence)
        nextSequence += 1
      }

      if (appendedPatch.length > 0) {
        nextSequenceRef.current = nextSequence
        appendPatchChunk(appendedPatch)
      }
    }

    const scheduleChunkFlush = () => {
      if (flushFrameRef.current !== null) return
      flushFrameRef.current = window.requestAnimationFrame(flushPendingChunks)
    }

    const handleStreamChunk = (sequence: number, chunk: string) => {
      pendingChunksRef.current.set(sequence, chunk)
      scheduleChunkFlush()
    }

    const finishStream = () => {
      cancelChunkFlush()
      flushPendingChunks()
      pendingChunksRef.current.clear()
    }

    const unsubscribe = subscribeDesktopEvents((event) => {
      if (!(active && isProjectDiffStreamEvent(event))) return
      const streamEvent = event.event
      if (streamEvent.streamId !== streamId) return

      if (streamEvent.type === 'chunk') {
        handleStreamChunk(streamEvent.sequence, streamEvent.chunk)
        return
      }

      finishStream()

      if (streamEvent.type === 'complete') {
        setDiff(streamEvent.result)
        setStreamedPatch((current) => (streamEvent.result ? current : ''))
        setIsLoading(false)
        return
      }

      setError(streamEvent.error)
      setStreamedPatch(null)
      setIsLoading(false)
    })

    startProjectDiffStreamQuery(projectId, baseline, streamId, includeUntracked).then(
      (result) => {
        if (!active) return
        if (!result || result.streamId !== streamId) {
          setIsLoading(false)
          setError('Could not start diff stream.')
        }
      },
      (streamError: Error) => {
        if (!active) return
        setIsLoading(false)
        setError(streamError.message)
      },
    )

    return () => {
      active = false
      cancelChunkFlush()
      pendingChunksRef.current.clear()
      unsubscribe()
      void cancelProjectDiffStreamQuery(streamId)
    }
  }, [baseline, canStream, includeUntracked, projectId, refreshVersion])

  return useMemo(
    () => ({ canStream, diff, error, isLoading, streamedPatch }),
    [canStream, diff, error, isLoading, streamedPatch],
  )
}

export function useDesktopDiff(
  projectId: string | null,
  baseline: ProjectDiffBaseline | null = null,
  enabled = true,
  includeUntracked = false,
) {
  const streamRefreshVersion = useProjectDiffInvalidationVersion(projectId)
  const stream = useProjectDiffStream(
    projectId,
    baseline,
    enabled,
    includeUntracked,
    streamRefreshVersion,
  )
  const streamUnavailable = enabled && Boolean(projectId) && !stream.canStream
  const rawError = streamUnavailable ? 'Diff streaming is unavailable.' : stream.error

  return {
    diff: stream.diff,
    streamedPatch: stream.streamedPatch,
    isLoading: stream.isLoading,
    error: enabled && projectId ? getReadableDesktopDiffError(rawError) : null,
  } satisfies DiffState
}
