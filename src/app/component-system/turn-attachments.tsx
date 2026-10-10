import type { PluginRendererContribution } from '@howaboua/howcode-sdk/plugins'
import { useInstalledRendererContributions } from './installed-component-catalog'
import { RendererSlot } from './renderer-slots'

/** Installed components resolve their durable attachments independently of tool presentation. */
export function TurnAttachments({
  conversationId,
  turnId,
}: {
  conversationId: string
  turnId: string
}) {
  const installedRendererContributions = useInstalledRendererContributions()
  return Object.entries(installedRendererContributions).map(([name, installed]) => {
    const contribution: PluginRendererContribution = installed
    const Attachments = contribution.TurnAttachments
    return Attachments ? (
      <RendererSlot key={name} name={name}>
        <Attachments conversationId={conversationId} turnId={turnId} />
      </RendererSlot>
    ) : null
  })
}
