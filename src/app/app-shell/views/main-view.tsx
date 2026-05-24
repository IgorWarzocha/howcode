import { getComingSoonViewContent } from '@howcode/roadmaps'
import { MarkdownContent } from '../../common/markdown-content'
import { ViewHeader } from '../../common/view-header'
import { ViewShell } from '../../common/view-shell'
import type { View } from '../../types'
import { appTypeReadableClass } from '../../ui/classes'

type MainViewProps = {
  activeView: View
  projectName?: string
}

function AutomationsStubView({ projectName }: { projectName: string }) {
  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <ViewHeader title="Automations" subtitle={`${projectName} · project automation surface`} />

      <div className={`grid gap-3 ${appTypeReadableClass}`}>
        <p>
          Automations will live here for this project. For now this is a project-scoped stub so the
          new sidebar can route to the right surface without pretending the feature is ready.
        </p>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 text-[color:var(--muted)]">
          Coming next: recurring checks, branch/worktree tasks, and project-local automation runs.
        </div>
      </div>
    </ViewShell>
  )
}

export function MainView({ activeView, projectName = 'Current project' }: MainViewProps) {
  if (activeView === 'automations') {
    return <AutomationsStubView projectName={projectName} />
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
