import {
  appToneMutedClass,
  appToneTextClass,
  appTypeSmallClass,
  composerOverlayPanelInsetClass,
  composerPopoverOptionClass,
  composerPopoverOptionSelectedClass,
  composerPopoverPanelClass,
  composerPopoverSectionLabelClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import type { RefObject } from 'react'
import { PopoverPanel } from '../common/popover'
import { cn } from '../utils/cn'
import {
  type ComposerSlashCommands,
  getComposerSlashCommandGroupLabel,
  getComposerSlashCommandOptionId,
} from './useComposerSlashCommands'

function SlashCommandOption({
  command,
  index,
  previousCommand,
  selected,
  slashCommands,
}: {
  command: ComposerSlashCommands['commands'][number]
  index: number
  previousCommand: ComposerSlashCommands['commands'][number] | undefined
  selected: boolean
  slashCommands: ComposerSlashCommands
}) {
  const groupLabel = getComposerSlashCommandGroupLabel(command)
  const previousGroupLabel = previousCommand
    ? getComposerSlashCommandGroupLabel(previousCommand)
    : null
  return (
    <div key={`${command.source}:${command.name}`}>
      {previousGroupLabel === groupLabel ? null : (
        <div className={cn(composerPopoverSectionLabelClass, 'pt-1 pb-0.5')}>{groupLabel}</div>
      )}
      <button
        id={getComposerSlashCommandOptionId(index)}
        type="button"
        role="option"
        aria-selected={selected}
        className={cn(
          composerPopoverOptionClass,
          'grid min-h-6 grid-cols-[max-content_minmax(0,1fr)] px-2 py-0.5',
          selected
            ? composerPopoverOptionSelectedClass
            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
        onPointerEnter={() => slashCommands.setSelectedIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => slashCommands.selectCommand(command)}
      >
        <span className={cn('shrink-0 whitespace-nowrap', appTypeSmallClass, appToneTextClass)}>
          /{command.name}
        </span>
        {command.description ? (
          <span className={cn('min-w-0 truncate', appTypeSmallClass, appToneMutedClass)}>
            {command.description}
          </span>
        ) : null}
      </button>
    </div>
  )
}

export function SlashCommandPanel({
  panelRef,
  slashCommands,
  topRounded = true,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
  topRounded?: boolean | undefined
}) {
  if (!slashCommands.open) return null
  return (
    <div className={composerOverlayPanelInsetClass}>
      <PopoverPanel
        surface={false}
        ref={panelRef}
        id={slashCommands.listboxId}
        role="listbox"
        tabIndex={-1}
        aria-label="Composer slash commands"
        className={cn(
          composerPopoverPanelClass,
          topRounded ? 'rounded-t-lg' : 'rounded-t-none',
          'max-h-64 overflow-y-auto overflow-x-hidden rounded-b-none p-1 shadow-none outline outline-1 -outline-offset-1 outline-[color:var(--border)]',
        )}
      >
        {slashCommands.commands.length > 0 ? (
          slashCommands.commands.map((command, index) => (
            <SlashCommandOption
              key={`${command.source}:${command.name}`}
              command={command}
              index={index}
              previousCommand={slashCommands.commands[index - 1]}
              selected={index === slashCommands.selectedIndex}
              slashCommands={slashCommands}
            />
          ))
        ) : (
          <div className={inlineEmptyNoteClass}>
            {slashCommands.loading ? 'Loading commands…' : 'No matching commands'}
          </div>
        )}
      </PopoverPanel>
    </div>
  )
}
