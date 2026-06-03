import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import type { RefObject } from 'react'
import { composerPopoverInputLayerClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { ComposerSessionTreePanel } from './composer-session-tree-panel'
import { SlashCommandPanel } from './composer-slash-command-panel'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

export function ComposerPromptPopoverStack({
  sessionPath,
  sessionTreeOpen = false,
  treeFilterMode = 'no-tools',
  sessionTreePanelRef,
  slashCommandPanelRef,
  slashCommands,
}: {
  sessionPath?: string | null | undefined
  sessionTreeOpen?: boolean | undefined
  treeFilterMode?: PiTreeFilterMode | undefined
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
      <ComposerSessionTreePanel
        panelRef={sessionTreePanelRef}
        sessionPath={sessionPath}
        treeFilterMode={treeFilterMode}
        open={sessionTreeOpen}
      />
      <SlashCommandPanel panelRef={slashCommandPanelRef} slashCommands={slashCommands} />
    </div>
  )
}
