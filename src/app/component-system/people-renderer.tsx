import { useContext } from 'react'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

export function InstalledPeopleComposerControl({
  onManage,
}: {
  onManage: (packageName: string) => void
}) {
  const providers = useContext(RendererHostsContext).filter(
    ({ contribution, host }) => host.enabled && contribution.people,
  )
  if (providers.length > 1) return <p role="alert">Conflicting component People providers.</p>
  const renderer = providers[0]
  const Control = renderer?.contribution.people?.ComposerControl
  return renderer && Control ? (
    <RendererSlot name={renderer.name}>
      <Control host={renderer.host} onManage={() => onManage(renderer.name)} />
    </RendererSlot>
  ) : null
}
