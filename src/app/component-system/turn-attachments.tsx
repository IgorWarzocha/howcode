import type { PluginRendererContribution } from '@howaboua/howcode-sdk/plugins'
import { installedRendererContributions } from './installed-renderers.generated'

/** Installed components resolve their durable attachments independently of tool presentation. */
export function TurnAttachments({
  conversationId,
  turnId,
}: {
  conversationId: string
  turnId: string
}) {
  return Object.entries(installedRendererContributions).map(([name, installed]) => {
    const contribution: PluginRendererContribution = installed
    const Attachments = contribution.TurnAttachments
    return Attachments ? (
      <Attachments key={name} conversationId={conversationId} turnId={turnId} />
    ) : null
  })
}
