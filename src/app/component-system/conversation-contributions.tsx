import type { PluginConversation } from '@howaboua/howcode-sdk/plugins'
import { useContext } from 'react'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

export function InstalledWorkspaceSidebar({
  workspaceId,
  onOpenConversation,
}: {
  workspaceId: string
  onOpenConversation: (conversation: PluginConversation) => void
}) {
  const renderers = useContext(RendererHostsContext)
  return renderers.map(({ name, host, contribution }) => {
    const Content = contribution.WorkspaceSidebar
    return Content ? (
      <RendererSlot key={name} name={name}>
        <Content host={host} workspaceId={workspaceId} onOpenConversation={onOpenConversation} />
      </RendererSlot>
    ) : null
  })
}

export function InstalledWorkspaceActions({
  workspaceId,
  onClose,
  onOpenConversation,
}: {
  workspaceId: string
  onClose: () => void
  onOpenConversation: (conversation: PluginConversation) => void
}) {
  const renderers = useContext(RendererHostsContext)
  return renderers.map(({ name, host, contribution }) => {
    const Actions = contribution.WorkspaceActions
    return Actions ? (
      <RendererSlot key={name} name={name}>
        <Actions
          host={host}
          workspaceId={workspaceId}
          onClose={onClose}
          onOpenConversation={onOpenConversation}
        />
      </RendererSlot>
    ) : null
  })
}

export function InstalledConversationActions({ conversationId }: { conversationId: string }) {
  const renderers = useContext(RendererHostsContext)
  return renderers.map(({ name, host, contribution }) => {
    const Actions = contribution.ConversationActions
    return Actions ? (
      <RendererSlot key={name} name={name}>
        <Actions host={host} conversationId={conversationId} />
      </RendererSlot>
    ) : null
  })
}

export function InstalledConversationContent({ conversationId }: { conversationId: string }) {
  const renderers = useContext(RendererHostsContext)
  return renderers.map(({ name, host, contribution }) => {
    const Content = contribution.ConversationContent
    return Content ? (
      <RendererSlot key={name} name={name}>
        <Content host={host} conversationId={conversationId} />
      </RendererSlot>
    ) : null
  })
}
