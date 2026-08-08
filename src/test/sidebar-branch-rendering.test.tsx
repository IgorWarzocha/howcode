import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BranchThreadGroup } from '../app/components/sidebar/project-work/branch-group-model'
import { BranchThreadGroupSection } from '../app/components/sidebar/project-work/branch-thread-group-section'
import type { DesktopActionInvoker } from '../app/desktop/types'
import type { Project } from '../app/types'

const project: Project = {
  id: '/repo',
  name: 'Repo',
  threads: [],
}

const onAction: DesktopActionInvoker = async () => null

describe('sidebar branch rendering contracts', () => {
  it('renders a nested worktree session inside its parent branch', () => {
    const group: BranchThreadGroup = {
      id: 'main',
      label: 'main',
      current: true,
      unassigned: false,
      worktree: false,
      threads: [],
      worktrees: [
        {
          id: 'feature',
          label: 'feature',
          path: '/repo/.worktrees/feature',
          branchName: 'feature',
          parentBranchName: 'main',
          complete: false,
          threads: [
            {
              id: 'nested-session',
              title: 'Nested worktree session',
              age: 'Now',
              branchName: 'feature',
              sessionPath: '/sessions/nested.jsonl',
            },
          ],
        },
      ],
    }

    const markup = renderToStaticMarkup(
      <BranchThreadGroupSection
        activeView="thread"
        collapsed={false}
        currentBranch="main"
        group={group}
        hideSessionCounts={false}
        project={project}
        selectedThreadId={null}
        terminalRunningSessionPaths={new Set()}
        onAction={onAction}
        onThreadOpen={() => undefined}
        onToggle={() => undefined}
      />,
    )

    expect(markup).toContain('data-branch-group-kind="worktree"')
    expect(markup).toContain('Nested worktree session')
  })

  it('keeps the empty-branch start action in the prompt instead of duplicating it', () => {
    const group: BranchThreadGroup = {
      id: 'feature',
      label: 'feature',
      current: false,
      unassigned: false,
      worktree: false,
      threads: [],
      worktrees: [],
    }

    const markup = renderToStaticMarkup(
      <BranchThreadGroupSection
        activeView="thread"
        collapsed={false}
        currentBranch="main"
        group={group}
        hideSessionCounts={false}
        project={project}
        selectedThreadId={null}
        terminalRunningSessionPaths={new Set()}
        onAction={onAction}
        onThreadOpen={() => undefined}
        onToggle={() => undefined}
      />,
    )

    expect(markup.match(/Switch branches and start a new session/g)).toHaveLength(1)
  })
})
