import { composerPopoverInputLayerClass } from '@howaboua/howcode-sdk/ui/classes'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import type { RefObject } from 'react'
import { ComposerConversationForkPanel } from './composer-conversation-fork-panel'
import { SlashCommandPanel } from './composer-slash-command-panel'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

export function ComposerPromptPopoverStack({
  conversationId,
  conversationForkOpen,
  conversationForkPanelRef,
  slashCommandPanelRef,
  slashCommands,
  forkDisabled,
  onFork,
  onCloseConversationFork,
  popoverStackRef,
  embedded = false,
  topRounded = true,
}: {
  conversationId?: string | null | undefined
  conversationForkOpen: boolean
  conversationForkPanelRef: RefObject<HTMLDivElement | null>
  slashCommandPanelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
  forkDisabled: boolean
  onFork: (entryId: string) => Promise<boolean>
  onCloseConversationFork: () => void
  popoverStackRef?: RefObject<HTMLDivElement | null> | undefined
  embedded?: boolean | undefined
  topRounded?: boolean | undefined
}) {
  const stackVisible = conversationForkOpen || slashCommands.open
  return (
    <div
      ref={popoverStackRef}
      className={cn(
        embedded ? 'relative grid gap-1.5' : 'absolute right-0 bottom-full left-0 grid gap-1.5',
        composerPopoverInputLayerClass,
        !stackVisible && 'pointer-events-none invisible h-0 min-h-0 overflow-hidden gap-0',
      )}
    >
      <ComposerConversationForkPanel
        panelRef={conversationForkPanelRef}
        conversationId={conversationId}
        open={conversationForkOpen}
        forkDisabled={forkDisabled}
        onFork={onFork}
        onClose={onCloseConversationFork}
        topRounded={topRounded}
      />
      <SlashCommandPanel
        panelRef={slashCommandPanelRef}
        slashCommands={slashCommands}
        topRounded={topRounded && !conversationForkOpen}
      />
    </div>
  )
}
