import type { RefObject } from 'react'
import type { Message } from '../types'
import { composerPopoverInputLayerClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { ComposerSessionTreePanel } from './composer-session-tree-panel'
import { SlashCommandPanel } from './composer-slash-command-panel'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

export function ComposerPromptPopoverStack({
  messages,
  sessionTreePanelRef,
  slashCommandPanelRef,
  slashCommands,
}: {
  messages?: readonly Message[] | undefined
  sessionTreePanelRef: RefObject<HTMLDivElement | null>
  slashCommandPanelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
}) {
  return (
    <div
      className={cn(
        'absolute right-0 bottom-full left-0 grid gap-1.5',
        composerPopoverInputLayerClass,
      )}
    >
      <ComposerSessionTreePanel panelRef={sessionTreePanelRef} messages={messages} />
      <SlashCommandPanel panelRef={slashCommandPanelRef} slashCommands={slashCommands} />
    </div>
  )
}
