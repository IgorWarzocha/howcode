import { SkeletonBlock } from '../../components/common/skeleton'
import type { ProjectUsageSessionSummary } from '../../desktop/types'
import { formatCost, formatTokens } from './overview-formatters'

function TopSessionsSkeleton() {
  return (
    <div className="grid max-h-[9.75rem] w-full gap-1.5 overflow-hidden pr-8 [@media(max-height:760px)]:max-h-[3.25rem]">
      {['top-session-a', 'top-session-b', 'top-session-c'].map((rowId) => (
        <div
          key={rowId}
          className="grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
        >
          <SkeletonBlock className="h-3.5 w-[min(18rem,72%)] rounded-md" />
          <SkeletonBlock className="h-3 w-24 rounded-md opacity-60" />
        </div>
      ))}
    </div>
  )
}

function TopSessionRow({
  projectId,
  session,
  onOpenThread,
}: {
  projectId: string
  session: ProjectUsageSessionSummary
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <button
      type="button"
      className="grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-1 rounded-lg border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-left text-[12px] shadow-[var(--shadow)] transition-colors hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99] min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:gap-4"
      onClick={() => onOpenThread(projectId, session.threadId, session.sessionPath)}
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--text)]">
        {session.title}
      </span>
      <span className="min-w-0 truncate font-mono text-[color:var(--muted)] tabular-nums max-[559px]:justify-self-start">
        {formatCost(session.costTotal)} · {formatTokens(session.totalTokens)}
      </span>
    </button>
  )
}

export function TopSessionsSection({
  loading,
  projectId,
  sessions,
  onOpenThread,
}: {
  loading: boolean
  projectId: string
  sessions: ProjectUsageSessionSummary[]
  onOpenThread: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  return (
    <section className="col-span-2 col-start-2 grid gap-2 [@media(max-height:560px)]:hidden">
      <h2 className="m-0 w-[calc(100%-2.5rem)] px-1 text-[13px] font-medium text-[color:var(--text)]">
        Top sessions by cost
      </h2>
      {loading ? (
        <TopSessionsSkeleton />
      ) : sessions.length > 0 ? (
        <div className="grid max-h-[9.75rem] w-full gap-1.5 overflow-y-auto overflow-x-hidden pr-8 [scrollbar-gutter:stable] max-[560px]:max-h-[3.25rem] [@media(max-height:760px)]:max-h-[3.25rem]">
          {sessions.map((session) => (
            <TopSessionRow
              key={session.sessionPath}
              projectId={projectId}
              session={session}
              onOpenThread={onOpenThread}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[rgba(169,178,215,0.12)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
          No usage recorded yet. Start a session below and Pi usage will appear here after the first
          assistant response.
        </div>
      )}
    </section>
  )
}
