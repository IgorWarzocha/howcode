import type { PiTreeFilterMode } from '@howcode/shared/desktop-settings-contracts'
import type { MutableRefObject, RefObject } from 'react'
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
  sessionTreeForceHidden = false,
  sessionTreeNavigateDisabled = false,
  onSessionTreeNavigate,
  onSessionTreeLabel,
  onRevealSessionTreeEntryInThread,
  onBindSessionTreeClose,
  onSessionTreeNavigateConfirmOpenChange,
  onSessionTreeLabelPopoverOpenChange,
  sessionTreeCancelNavigateConfirmRef,
  sessionTreeCancelLabelPopoverRef,
  popoverStackRef,
  embedded = false,
  topRounded = true,
}: {
  sessionPath?: string | null | undefined
  sessionTreeOpen?: boolean | undefined
  treeFilterMode?: PiTreeFilterMode | undefined
  sessionTreePanelRef: RefObject<HTMLDivElement | null>
  slashCommandPanelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
  sessionTreeForceHidden?: boolean | undefined
  sessionTreeNavigateDisabled?: boolean | undefined
  onSessionTreeNavigate?:
    | ((entryId: string, summarize: boolean, label?: string) => Promise<boolean>)
    | undefined
  onSessionTreeLabel?: ((entryId: string, label: string) => Promise<boolean> | boolean) | undefined
  onRevealSessionTreeEntryInThread?: ((entryId: string) => void) | undefined
  onBindSessionTreeClose?: ((close: (() => void) | null) => void) | undefined
  onSessionTreeNavigateConfirmOpenChange?: ((open: boolean) => void) | undefined
  onSessionTreeLabelPopoverOpenChange?: ((open: boolean) => void) | undefined
  sessionTreeCancelNavigateConfirmRef?: MutableRefObject<(() => void) | null> | undefined
  sessionTreeCancelLabelPopoverRef?: MutableRefObject<(() => void) | null> | undefined
  popoverStackRef?: RefObject<HTMLDivElement | null> | undefined
  embedded?: boolean | undefined
  topRounded?: boolean | undefined
}) {
  const sessionTreeVisible = sessionTreeOpen && !sessionTreeForceHidden
  const slashVisible = slashCommands.open
  const stackVisible = sessionTreeVisible || slashVisible

  return (
    <div
      ref={popoverStackRef}
      className={cn(
        embedded ? 'relative grid gap-1.5' : 'absolute right-0 bottom-full left-0 grid gap-1.5',
        composerPopoverInputLayerClass,
        !stackVisible && 'pointer-events-none invisible h-0 min-h-0 overflow-hidden gap-0',
      )}
    >
      <ComposerSessionTreePanel
        panelRef={sessionTreePanelRef}
        sessionPath={sessionPath}
        treeFilterMode={treeFilterMode}
        open={sessionTreeOpen}
        forceHidden={sessionTreeForceHidden}
        navigateDisabled={sessionTreeNavigateDisabled}
        onNavigate={onSessionTreeNavigate}
        onLabelEntry={onSessionTreeLabel}
        onRevealInThread={onRevealSessionTreeEntryInThread}
        onBindClose={onBindSessionTreeClose}
        onNavigateConfirmOpenChange={onSessionTreeNavigateConfirmOpenChange}
        onLabelPopoverOpenChange={onSessionTreeLabelPopoverOpenChange}
        cancelNavigateConfirmRef={sessionTreeCancelNavigateConfirmRef}
        cancelLabelPopoverRef={sessionTreeCancelLabelPopoverRef}
        topRounded={topRounded}
      />
      <SlashCommandPanel
        panelRef={slashCommandPanelRef}
        slashCommands={slashCommands}
        topRounded={topRounded && !sessionTreeVisible}
      />
    </div>
  )
}
