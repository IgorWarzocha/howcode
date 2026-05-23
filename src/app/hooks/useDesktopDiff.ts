import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
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

function useProjectDiffStream(
  projectId: string | null,
  baseline: ProjectDiffBaseline | null,
  enabled: boolean,
) {
  const [streamId, setStreamId] = useState<string | null>(null)
  const [streamedPatch, setStreamedPatch] = useState<string | null>(null)
  const [diff, setDiff] = useState<ProjectDiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const canStream = enabled && Boolean(projectId) && canStartProjectDiffStreamQuery()

  useEffect(() => {
    if (!(canStream && projectId)) {
      setStreamId(null)
      setStreamedPatch(null)
      setDiff(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let active = true
    setStreamId(null)
    setStreamedPatch('')
    setDiff(null)
    setError(null)
    setIsLoading(true)

    startProjectDiffStreamQuery(projectId, baseline).then(
      (result) => {
        if (!active) return
        if (!result) {
          setIsLoading(false)
          setError('Could not start diff stream.')
          return
        }
        setStreamId(result.streamId)
      },
      (streamError: Error) => {
        if (!active) return
        setIsLoading(false)
        setError(streamError.message)
      },
    )

    return () => {
      active = false
    }
  }, [baseline, canStream, projectId])

  useEffect(() => {
    if (!(canStream && streamId)) return

    return subscribeDesktopEvents((event) => {
      if (!isProjectDiffStreamEvent(event)) return
      const streamEvent = event.event
      if (streamEvent.streamId !== streamId) return

      if (streamEvent.type === 'chunk') {
        setStreamedPatch((current) => `${current ?? ''}${streamEvent.chunk}`)
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
  }, [canStream, streamId])

  return useMemo(
    () => ({ canStream, diff, error, isLoading, streamedPatch }),
    [canStream, diff, error, isLoading, streamedPatch],
  )
}

export function useDesktopDiff(
  projectId: string | null,
  baseline: ProjectDiffBaseline | null = null,
  enabled = true,
) {
  const stream = useProjectDiffStream(projectId, baseline, enabled)
  const queryEnabled = enabled && Boolean(projectId) && !stream.canStream
  const query = useQuery<ProjectDiffResult | null, Error>({
    queryKey: projectId
      ? desktopQueryKeys.projectDiff(projectId, baseline)
      : ['desktop', 'projectDiff', null],
    queryFn: () => (projectId ? getProjectDiffQuery(projectId, baseline) : Promise.resolve(null)),
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
