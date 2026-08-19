import type { ComposerSlashCommand } from '../desktop/types'

const slashCommandSourceOrder: Record<ComposerSlashCommand['source'], number> = {
  prompt: 0,
  app: 1,
  builtin: 1,
  skill: 2,
  extension: 3,
}

const slashCommandSourceLabels: Record<ComposerSlashCommand['source'], string> = {
  app: 'System',
  builtin: 'System',
  extension: 'Extensions',
  prompt: 'Prompts',
  skill: 'Skills',
}

export const whitespaceCharacterPattern = /\s/
export const whitespaceRunPattern = /\s+/

export function getComposerSlashCommandGroupLabel(command: ComposerSlashCommand) {
  return slashCommandSourceLabels[command.source]
}

export const composerSlashCommandListboxId = 'composer-slash-command-listbox'

export function getComposerSlashCommandOptionId(index: number) {
  return `composer-slash-command-${index}`
}

export function getSlashCommandFilter(draft: string) {
  if (!draft.startsWith('/')) return null
  const query = draft.slice(1)
  if (whitespaceCharacterPattern.test(query)) return null
  return query.toLowerCase()
}

export function shouldWaitForSlashCommands(draft: string) {
  const trimmedDraft = draft.trim()
  return trimmedDraft.startsWith('/') && !trimmedDraft.includes(' ') && trimmedDraft !== '/settings'
}

export function sortComposerSlashCommands(commands: ComposerSlashCommand[]) {
  return commands.toSorted((left, right) => {
    const sourceOrder = slashCommandSourceOrder[left.source] - slashCommandSourceOrder[right.source]
    if (sourceOrder !== 0) return sourceOrder
    return left.name.localeCompare(right.name)
  })
}

export function filterComposerSlashCommands(
  commands: ComposerSlashCommand[],
  filter: string | null,
) {
  if (filter === null) return []
  return sortComposerSlashCommands(
    commands.filter((command) => command.name.toLowerCase().includes(filter)),
  )
}
