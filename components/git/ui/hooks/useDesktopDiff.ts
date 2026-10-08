import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanUserErrorMessage } from '../../../../src/app/desktop/error-messages'
import type {
  DesktopEvent,
  DirectoryDiffBaseline,
  DirectoryDiffResult,
} from '../../../../src/app/desktop/types'
import { subscribeDesktopEvents } from '../../../../src/app/query/desktop-query'
import {
  cancelDirectoryDiffStreamQuery,
  canStartDirectoryDiffStreamQuery,
  startDirectoryDiffStreamQuery,
} from '../query'
import { useDirectoryDiffInvalidationVersion } from './directory-diff-invalidation'

type DiffState = {
  diff: DirectoryDiffResult | null
  streamedPatch: string | null
  isLoading: boolean
  error: string | null
}

export function getReadableDesktopDiffError(error: string | null) {
  return error ? cleanUserErrorMessage(error, 'Could not load diff.') : null
}

function isDirectoryDiffStreamEvent(
  event: DesktopEvent,
): event is Extract<DesktopEvent, { type: 'directory-diff-stream' }> {
  return event.type === 'directory-diff-stream'
}

function createDirectoryDiffStreamId() {
  return window.crypto?.randomUUID?.() ?? `project-diff-${Date.now()}-${Math.random()}`
}

function useDirectoryDiffStream(
  directoryId: string | null,
  baseline: DirectoryDiffBaseline | null,
  enabled: boolean,
  includeUntracked: boolean,
  refreshVersion: number,
) {
  const scope = JSON.stringify([directoryId, baseline, enabled, includeUntracked, refreshVersion])
  const [state, setState] = useState<DiffState & { scope: string | null }>({
    scope: null,
    streamedPatch: null,
    diff: null,
    error: null,
    isLoading: false,
  })
  const pendingChunksRef = useRef(new Map<number, string>())
  const nextSequenceRef = useRef(0)
  const flushFrameRef = useRef<number | null>(null)
  const canStream = enabled && Boolean(directoryId) && canStartDirectoryDiffStreamQuery()

  useEffect(() => {
    void refreshVersion
    const cancelChunkFlush = () => {
      if (flushFrameRef.current === null) return
      window.cancelAnimationFrame(flushFrameRef.current)
      flushFrameRef.current = null
    }

    const resetStreamState = () => {
      setState({ scope, streamedPatch: null, diff: null, error: null, isLoading: false })
      pendingChunksRef.current.clear()
      nextSequenceRef.current = 0
      cancelChunkFlush()
    }

    if (!(canStream && directoryId)) {
      resetStreamState()
      return
    }

    let active = true
    const streamId = createDirectoryDiffStreamId()
    setState({ scope, streamedPatch: '', diff: null, error: null, isLoading: true })
    pendingChunksRef.current.clear()
    nextSequenceRef.current = 0
    cancelChunkFlush()

    const appendPatchChunk = (chunk: string) => {
      setState((current) => ({
        ...current,
        streamedPatch: `${current.streamedPatch ?? ''}${chunk}`,
      }))
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
      if (!(active && isDirectoryDiffStreamEvent(event))) return
      const streamEvent = event.event
      if (streamEvent.streamId !== streamId) return

      if (streamEvent.type === 'chunk') {
        handleStreamChunk(streamEvent.sequence, streamEvent.chunk)
        return
      }

      finishStream()

      if (streamEvent.type === 'complete') {
        setState((current) => ({
          ...current,
          diff: streamEvent.result,
          streamedPatch: streamEvent.result ? current.streamedPatch : '',
          isLoading: false,
        }))
        return
      }

      setState((current) => ({
        ...current,
        error: streamEvent.error,
        streamedPatch: null,
        isLoading: false,
      }))
    })

    startDirectoryDiffStreamQuery(directoryId, baseline, streamId, includeUntracked).then(
      (result) => {
        if (!active) return
        if (!result || result.streamId !== streamId) {
          setState((current) => ({
            ...current,
            isLoading: false,
            error: 'Could not start diff stream.',
          }))
        }
      },
      (streamError: Error) => {
        if (!active) return
        setState((current) => ({ ...current, isLoading: false, error: streamError.message }))
      },
    )

    return () => {
      active = false
      cancelChunkFlush()
      pendingChunksRef.current.clear()
      unsubscribe()
      void cancelDirectoryDiffStreamQuery(streamId)
    }
  }, [baseline, canStream, includeUntracked, directoryId, refreshVersion, scope])

  return useMemo(
    () =>
      state.scope === scope
        ? { canStream, ...state }
        : { canStream, diff: null, error: null, isLoading: canStream, streamedPatch: null },
    [state, scope, canStream],
  )
}

export function useDesktopDiff(
  directoryId: string | null,
  baseline: DirectoryDiffBaseline | null = null,
  enabled = true,
  includeUntracked = false,
) {
  const streamRefreshVersion = useDirectoryDiffInvalidationVersion(directoryId)
  const stream = useDirectoryDiffStream(
    directoryId,
    baseline,
    enabled,
    includeUntracked,
    streamRefreshVersion,
  )
  const streamUnavailable = enabled && Boolean(directoryId) && !stream.canStream
  const rawError = streamUnavailable ? 'Diff streaming is unavailable.' : stream.error

  return {
    diff: stream.diff,
    streamedPatch: stream.streamedPatch,
    isLoading: stream.isLoading,
    error: enabled && directoryId ? getReadableDesktopDiffError(rawError) : null,
  } satisfies DiffState
}
