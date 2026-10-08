import {
  type GitDiffPresentationState,
  type GitDiffResult,
  type GitDiffStats,
  gitDiffDetail,
  gitDiffSummary,
  parseGitDiffResult,
} from '@howaboua/pi-durable-git/contracts'
import {
  bindCapability,
  type UiBinding,
  type UiCapability,
  type UiCapabilityInstance,
  type UiPresentation,
  type UiPresentationSession,
  type UiSnapshot,
} from '@howaboua/pi-durable-ui'
import { useQuery } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type { DirectoryDiffBaseline, DirectoryGitState } from '../../../../src/app/desktop/types'
import { desktopQueryKeys } from '../../../../src/app/query/desktop-query'
import { getBaselineCounts } from '../gitops/composer-diff-baseline-data'
import { useDesktopDiff } from '../hooks/useDesktopDiff'
import { getDirectoryDiffStatsQuery } from '../query'

const emptyStats: GitDiffStats = { fileCount: 0, insertions: 0, deletions: 0 }
function parsePresentationState(value: unknown): GitDiffPresentationState {
  if (!value || typeof value !== 'object' || !('stats' in value) || !('detail' in value)) {
    throw new TypeError('Invalid Git presentation state')
  }
  const stats = value.stats
  if (!stats || typeof stats !== 'object' || !('fileCount' in stats)) {
    throw new TypeError('Invalid Git presentation stats')
  }
  const parsedStats = parseGitDiffResult({ ...stats, diff: '' })
  return {
    stats: {
      fileCount: parsedStats.fileCount,
      insertions: parsedStats.insertions,
      deletions: parsedStats.deletions,
    },
    detail: value.detail === null ? null : parseGitDiffResult(value.detail),
  }
}
const capability: UiCapability<GitDiffPresentationState> = {
  id: 'howcode.git.diff',
  version: 1,
  actions: [],
  streams: [],
  presentations: [gitDiffSummary.id, gitDiffDetail.id],
  parseState: parsePresentationState,
}

function createDiffBinding() {
  let snapshot: UiSnapshot = { sequence: 0, value: { stats: { ...emptyStats }, detail: null } }
  const listeners = new Set<(value: UiSnapshot) => void>()
  const binding: UiBinding = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async call(action) {
      throw new Error(`Unsupported Git presentation action: ${action}`)
    },
  }
  return {
    binding,
    publish(stats: GitDiffStats, detail: GitDiffResult | null) {
      snapshot = {
        sequence: snapshot.sequence + 1,
        value: {
          stats: {
            fileCount: stats.fileCount,
            insertions: stats.insertions,
            deletions: stats.deletions,
          },
          detail: detail
            ? {
                diff: detail.diff,
                fileCount: detail.fileCount,
                insertions: detail.insertions,
                deletions: detail.deletions,
              }
            : null,
        },
      }
      for (const listener of listeners) listener(snapshot)
    },
  }
}

type DiffPresentationOwner = {
  instance: UiCapabilityInstance<GitDiffPresentationState> | null
  stream: ReturnType<typeof useDesktopDiff>
  statsReady: boolean
  error: string | null
  openDetail: () => void
  reportError: (error: unknown) => void
}
const DiffPresentationContext = createContext<DiffPresentationOwner | null>(null)

/** One source identity and reader shared by all host-styled Git presentations. */
export function GitDiffPresentationProvider({
  directoryId,
  baseline,
  includeUntracked,
  directoryGitState,
  detailEnabled,
  onOpenDetail,
  children,
}: {
  directoryId: string
  baseline: DirectoryDiffBaseline
  includeUntracked: boolean
  directoryGitState: DirectoryGitState | null
  detailEnabled: boolean
  onOpenDetail: () => void
  children: ReactNode
}) {
  const identity = JSON.stringify([directoryId, baseline, includeUntracked])
  const source = useMemo(() => {
    void identity
    return createDiffBinding()
  }, [identity])
  const [bound, setBound] = useState<{
    source: typeof source
    instance: UiCapabilityInstance<GitDiffPresentationState> | null
    error: string | null
  } | null>(null)
  const gitState = directoryGitState?.directoryId === directoryId ? directoryGitState : null
  const stream = useDesktopDiff(
    directoryId,
    baseline,
    detailEnabled && !!gitState?.isGitRepo,
    includeUntracked,
  )
  // Completed detail already contains authoritative stats. Never start a second stats read for detail.
  const statsQuery = useQuery({
    queryKey: desktopQueryKeys.directoryDiffStats(directoryId, baseline, includeUntracked),
    queryFn: () => getDirectoryDiffStatsQuery(directoryId, baseline, includeUntracked),
    enabled:
      !detailEnabled &&
      !!directoryId &&
      !!gitState?.isGitRepo &&
      (baseline.kind !== 'head' || includeUntracked),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const counts = useMemo(
    () =>
      stream.diff ??
      getBaselineCounts({
        baselineStats: statsQuery.data,
        includeUntracked,
        directoryGitState: gitState,
        selectedBaseline: baseline,
      }),
    [stream.diff, statsQuery.data, includeUntracked, gitState, baseline],
  )
  useEffect(() => {
    source.publish(counts ?? emptyStats, stream.diff)
  }, [source, counts, stream.diff])
  useEffect(() => {
    const controller = new AbortController()
    const fail = (error: unknown) => {
      if (!controller.signal.aborted)
        setBound({
          source,
          instance: null,
          error: error instanceof Error ? error.message : 'Could not bind Git presentations.',
        })
    }
    void bindCapability(capability, {
      id: identity,
      signal: controller.signal,
      binding: source.binding,
    }).then((instance) => {
      if (controller.signal.aborted) return
      setBound({ source, instance, error: null })
      void instance.closed.catch(fail)
    }, fail)
    return () => {
      controller.abort()
    }
  }, [identity, source])
  const current = bound?.source === source ? bound : null
  const value = useMemo<DiffPresentationOwner>(
    () => ({
      instance: current?.instance ?? null,
      stream,
      statsReady: counts !== null,
      error: current?.error ?? (detailEnabled ? null : statsQuery.error?.message) ?? null,
      openDetail: onOpenDetail,
      reportError: (error) =>
        setBound({
          source,
          instance: current?.instance ?? null,
          error: error instanceof Error ? error.message : 'Could not open Git detail.',
        }),
    }),
    [current, stream, counts, detailEnabled, statsQuery.error, onOpenDetail, source],
  )
  return (
    <DiffPresentationContext.Provider value={value}>{children}</DiffPresentationContext.Provider>
  )
}

function useDiffPresentationOwner() {
  const owner = useContext(DiffPresentationContext)
  if (!owner) throw new Error('Git presentations require GitDiffPresentationProvider')
  return owner
}

const subscribeNothing = () => () => {
  /* No source until the SDK session is bound. */
}
const getEmptySnapshot = () => null

function useGitPresentation<Model>(descriptor: UiPresentation<GitDiffPresentationState, Model>) {
  const owner = useDiffPresentationOwner()
  const { instance, openDetail } = owner
  const [view, setView] = useState<{
    instance: UiCapabilityInstance<GitDiffPresentationState>
    session: UiPresentationSession<Model>
  } | null>(null)
  useEffect(() => {
    if (!instance) return
    const controller = new AbortController()
    const child = instance.present(descriptor, {
      signal: controller.signal,
      onRequestPresentation: () => openDetail(),
    })
    setView({ instance, session: child })
    return () => {
      controller.abort()
    }
  }, [descriptor, instance, openDetail])
  const context =
    view?.instance === instance && !view.session.context.signal.aborted
      ? view.session.context
      : null
  const model = useSyncExternalStore(
    context?.state.subscribe ?? subscribeNothing,
    context?.state.getSnapshot ?? getEmptySnapshot,
    getEmptySnapshot,
  )
  return { owner, model, context }
}

export function useGitDiffSummary() {
  const { owner, model, context } = useGitPresentation(gitDiffSummary)
  return {
    counts: owner.statsReady ? model : null,
    error: owner.error,
    requestDetail: () => {
      // The host action remains available during initial SDK binding.
      if (!context) {
        owner.openDetail()
        return
      }
      void context.requestPresentation(gitDiffDetail.id).catch((error: unknown) => {
        if (!context.signal.aborted) owner.reportError(error)
      })
    },
  }
}

export function useGitDiffDetail() {
  const { owner, model } = useGitPresentation(gitDiffDetail)
  const result = owner.stream.diff
  const current =
    result &&
    model &&
    result.diff === model.diff &&
    result.fileCount === model.fileCount &&
    result.insertions === model.insertions &&
    result.deletions === model.deletions
  return {
    ...owner.stream,
    diff: current ? { ...result, ...model } : null,
    error: owner.error ?? owner.stream.error,
  }
}
