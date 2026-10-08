import { getComingSoonViewContent } from '@howcode/roadmaps'
import { MarkdownContent } from '../../common/markdown-content'
import { ViewHeader } from '../../common/view-header'
import { ViewShell } from '../../common/view-shell'
import type { View } from '../../types'
import { appTypeReadableClass } from '../../ui/classes'

type MainViewProps = {
  activeView: View
  directoryName?: string
}

function AutomationsStubView({ directoryName }: { directoryName: string }) {
  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <ViewHeader
        title="Automations"
        subtitle={`${directoryName} · workspace automation surface`}
      />

      <div className={`grid gap-3 ${appTypeReadableClass}`}>
        <p>
          Automations will live here for this workspace. For now this is a directory-scoped stub so
          the new sidebar can route to the right surface without pretending the feature is ready.
        </p>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-[color:var(--muted)]">
          Coming next: recurring checks, branch/worktree tasks, and directory-local automation runs.
        </div>
      </div>
    </ViewShell>
  )
}

export function MainView({ activeView, directoryName = 'Current workspace' }: MainViewProps) {
  if (activeView === 'automations') {
    return <AutomationsStubView directoryName={directoryName} />
  }

  if (activeView !== 'chat' && activeView !== 'claw' && activeView !== 'work') {
    return null
  }

  const content = getComingSoonViewContent(activeView)

  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <ViewHeader title={content.title} subtitle={content.subtitle} />

      <MarkdownContent markdown={content.markdown} className={`gap-3 ${appTypeReadableClass}`} />
    </ViewShell>
  )
}
