import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cleanUserErrorMessage } from '../desktop/error-messages'
import type { DesktopEvent, ProjectDiffBaseline, ProjectDiffResult } from '../desktop/types'
import {
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

function useProjectDiffStream(
  projectId: string | null,
  baseline: ProjectDiffBaseline | null,
  enabled: boolean,
  includeUntracked: boolean,
) {
  const [streamedPatch, setStreamedPatch] = useState<string | null>(null)
  const [diff, setDiff] = useState<ProjectDiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const nextSequenceRef = useRef(0)
  const canStream = enabled && Boolean(projectId) && canStartProjectDiffStreamQuery()

  useEffect(() => {
    const resetStreamState = () => {
      setStreamedPatch(null)
      setDiff(null)
      setError(null)
      setIsLoading(false)
      nextSequenceRef.current = 0
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
    nextSequenceRef.current = 0

    const appendPatchChunk = (chunk: string) => {
      setStreamedPatch((current) => `${current ?? ''}${chunk}`)
    }

    const handleStreamChunk = (sequence: number, chunk: string) => {
      if (sequence !== nextSequenceRef.current) return
      nextSequenceRef.current = sequence + 1
      flushSync(() => appendPatchChunk(chunk))
    }

    const unsubscribe = subscribeDesktopEvents((event) => {
      if (!(active && isProjectDiffStreamEvent(event))) return
      const streamEvent = event.event
      if (streamEvent.streamId !== streamId) return

      if (streamEvent.type === 'chunk') {
        handleStreamChunk(streamEvent.sequence, streamEvent.chunk)
        return
      }

      if (streamEvent.type === 'complete') {
        setDiff(streamEvent.result)
        setStreamedPatch(streamEvent.result?.diff ?? '')
        setIsLoading(false)
        return
      }

      setError(streamEvent.error)
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
      unsubscribe()
    }
  }, [baseline, canStream, includeUntracked, projectId])

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
  const stream = useProjectDiffStream(projectId, baseline, enabled, includeUntracked)
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
