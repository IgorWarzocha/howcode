import {
  appToneMutedClass,
  appToneTextClass,
  appTypeCodeClass,
  appTypeSmallClass,
  composerPopoverInputLayerClass,
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
        <div className={cn(composerPopoverSectionLabelClass, 'pt-1.5 pb-1')}>{groupLabel}</div>
      )}
      <button
        id={getComposerSlashCommandOptionId(index)}
        type="button"
        role="option"
        aria-selected={selected}
        className={cn(
          composerPopoverOptionClass,
          'grid min-h-8 grid-cols-[max-content_minmax(0,1fr)] py-1.5',
          selected
            ? composerPopoverOptionSelectedClass
            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
        onPointerEnter={() => slashCommands.setSelectedIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => slashCommands.selectCommand(command)}
      >
        <span className={cn('shrink-0 whitespace-nowrap', appTypeCodeClass, appToneTextClass)}>
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
}: {
  panelRef: RefObject<HTMLDivElement | null>
  slashCommands: ComposerSlashCommands
}) {
  if (!slashCommands.open) return null
  return (
    <PopoverPanel
      surface={false}
      ref={panelRef}
      id={slashCommands.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer slash commands"
      className={cn(
        composerPopoverPanelClass,
        composerPopoverInputLayerClass,
        'absolute right-0 bottom-full left-0 max-h-64 overflow-y-auto overflow-x-hidden',
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
  )
}
