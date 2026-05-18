import type { KeyboardEvent } from 'react'
import type { ComposerSlashCommand } from '../../../desktop/types'
import { shouldWaitForSlashCommands } from './composer-slash-command-utils'

export function handleOpenSlashCommandKey(input: {
  completeCommand: (command: ComposerSlashCommand) => void
  draft: string
  event: KeyboardEvent<HTMLTextAreaElement>
  filteredCommands: ComposerSlashCommand[]
  loading: boolean
  selectedIndex: number
  selectCommand: (command: ComposerSlashCommand) => void
  setSelectedIndex: (updater: (current: number) => number) => void
  submit: () => void
}) {
  if (input.event.key === 'Escape') return false
  if (input.event.key === 'ArrowDown') {
    input.event.preventDefault()
    input.setSelectedIndex((current) =>
      Math.min(current + 1, Math.max(0, input.filteredCommands.length - 1)),
    )
    return true
  }
  if (input.event.key === 'ArrowUp') {
    input.event.preventDefault()
    input.setSelectedIndex((current) => Math.max(0, current - 1))
    return true
  }
  const selectedCommand = input.filteredCommands[input.selectedIndex]
  if (input.event.key === 'Tab' && !input.event.shiftKey && selectedCommand) {
    input.event.preventDefault()
    input.completeCommand(selectedCommand)
    return true
  }
  if (input.event.key === 'Enter' && !input.event.shiftKey && selectedCommand) {
    input.event.preventDefault()
    input.selectCommand(selectedCommand)
    return true
  }
  if (input.event.key !== 'Enter' || input.event.shiftKey) return false
  if (input.draft !== '/settings' && !(input.loading && shouldWaitForSlashCommands(input.draft)))
    return false
  input.event.preventDefault()
  if (input.draft === '/settings' || input.draft === '/new') input.submit()
  return true
}
