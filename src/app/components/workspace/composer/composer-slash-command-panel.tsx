import type { RefObject } from 'react'
import { cn } from '../../../utils/cn'
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
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
          {groupLabel}
        </div>
      )}
      <button
        id={getComposerSlashCommandOptionId(index)}
        type="button"
        role="option"
        aria-selected={selected}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
          selected
            ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
            : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
        )}
        onPointerEnter={() => slashCommands.setSelectedIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => slashCommands.selectCommand(command)}
      >
        <span className="shrink-0 font-mono text-[12px] text-[color:var(--text)]">
          /{command.name}
        </span>
        {command.description ? (
          <span className="min-w-0 truncate text-[12px]">{command.description}</span>
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
    <div
      ref={panelRef}
      id={slashCommands.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer slash commands"
      className="absolute right-0 bottom-full left-0 z-20 max-h-64 scroll-py-1.5 overflow-auto rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-1.5 shadow-[var(--shadow)]"
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
        <div className="px-2 py-2 text-[12px] text-[color:var(--muted)]">
          {slashCommands.loading ? 'Loading commands…' : 'No matching commands'}
        </div>
      )}
    </div>
  )
}
