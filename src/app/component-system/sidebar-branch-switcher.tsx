import type { SidebarBranchSwitcherProps } from '@howaboua/howcode-sdk/sidebar-worktrees'
import { useContext } from 'react'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

export function InstalledSidebarBranchSwitcher(props: SidebarBranchSwitcherProps) {
  const renderer = useContext(RendererHostsContext).find(
    (candidate) => candidate.contribution.navigation?.BranchSwitcher,
  )
  const Content = renderer?.contribution.navigation?.BranchSwitcher
  if (!(renderer?.host.enabled && Content)) return <span>{props.branchLabel}</span>
  return (
    <RendererSlot name={renderer.name}>
      <Content {...props} />
    </RendererSlot>
  )
}
