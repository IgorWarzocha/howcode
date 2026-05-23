import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanUserErrorMessage } from '../desktop/error-messages'
import type { DesktopEvent, ProjectDiffBaseline, ProjectDiffResult } from '../desktop/types'
import {
  cancelProjectDiffStreamQuery,
  canStartProjectDiffStreamQuery,
  desktopQueryKeys,
  getProjectDiffQuery,
  startProjectDiffStreamQuery,
  subscribeDesktopEvents,
} from '../query/desktop-query'

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

function isCurrentProjectDiffQuery(queryKey: readonly unknown[], projectId: string) {
  return queryKey[0] === 'desktop' && queryKey[1] === 'projectDiff' && queryKey[2] === projectId
}

function useProjectDiffInvalidationVersion(projectId: string | null) {
  const queryClient = useQueryClient()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!projectId) return
    return queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event.query.queryKey
      if (!isCurrentProjectDiffQuery(queryKey, projectId)) return
      if (event.type === 'removed' || event.query.state.isInvalidated) {
        setVersion((current) => current + 1)
      }
    })
  }, [projectId, queryClient])

  return version
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
  const queryEnabled = enabled && Boolean(projectId) && !stream.canStream
  const query = useQuery<ProjectDiffResult | null, Error>({
    queryKey: projectId
      ? desktopQueryKeys.projectDiff(projectId, baseline, includeUntracked)
      : ['desktop', 'projectDiff', null],
    queryFn: () =>
      projectId
        ? getProjectDiffQuery(projectId, baseline, includeUntracked)
        : Promise.resolve(null),
    enabled: queryEnabled,
    refetchOnMount: 'always',
  })

  const rawError = stream.canStream ? stream.error : (query.error?.message ?? null)

  return {
    diff: stream.canStream ? stream.diff : (query.data ?? null),
    streamedPatch: stream.canStream ? stream.streamedPatch : null,
    isLoading: stream.canStream ? stream.isLoading : query.isLoading || query.isFetching,
    error: queryEnabled || stream.canStream ? getReadableDesktopDiffError(rawError) : null,
  } satisfies DiffState
}
