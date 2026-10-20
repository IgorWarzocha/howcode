import type { PluginConversation } from '@howaboua/howcode-sdk/plugins'
import { type ReactNode, useContext } from 'react'
import { RendererHostsContext } from '../component-system/installed-renderer-context'
import { RendererSlot } from '../component-system/renderer-slots'
import { SettingsAiServices } from '../settings/settings/settingsAiServices'

/** The feature owns setup; the shell supplies authentication and ordinary chat navigation. */
export function AssistantEntry({
  children,
  onOpenConversation,
}: {
  children: ReactNode
  onOpenConversation: (conversation: PluginConversation) => void
}) {
  const entries = useContext(RendererHostsContext).filter(
    ({ host, contribution }) => host.enabled && contribution.FirstRun,
  )
  if (entries.length === 0) return children
  if (entries.length !== 1)
    return (
      <p role="alert">
        More than one assistant setup component is enabled. Choose one in component settings.
      </p>
    )
  const renderer = entries[0]
  const Content = renderer?.contribution.FirstRun
  if (!(renderer && Content)) return children
  return (
    <RendererSlot name={renderer.name}>
      <Content
        host={renderer.host}
        modelAccess={<SettingsAiServices />}
        onOpenConversation={onOpenConversation}
      />
    </RendererSlot>
  )
}
