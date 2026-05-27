import type { ComposerSlashCommand } from '../desktop/types'
import { getComposerSlashCommandsQuery } from '../query/desktop-query'
import { shouldWaitForSlashCommands, whitespaceRunPattern } from './composer-slash-command-utils'

export function resolveSlashCommandAfterLoad(input: {
  commandScopeKey: string
  commandScopeKeyRef: { current: string }
  composerMode: 'chat' | 'code'
  draft: string
  draftRef: { current: string }
  projectId: string
  send: () => void
  sendExtensionCommand: (() => void) | undefined
  sessionPath: string | null
}) {
  void getComposerSlashCommandsQuery({
    projectId: input.projectId,
    sessionPath: input.sessionPath,
    composerMode: input.composerMode,
  })
    .then((nextCommands) => {
      if (
        input.draftRef.current !== input.draft ||
        input.commandScopeKeyRef.current !== input.commandScopeKey
      )
        return
      const commandName = input.draft.trim().slice(1).split(whitespaceRunPattern, 1)[0]
      const resolvedCommand = nextCommands.find((command) => command.name === commandName)
      if (resolvedCommand?.source === 'extension') input.sendExtensionCommand?.()
      else if (resolvedCommand) input.send()
    })
    .catch(() => {
      // Keep slash text in the editor rather than leaking an unresolved command to the model.
    })
}

export function tryResolveSlashDraft(input: {
  commandScopeKey: string
  commandScopeKeyRef: { current: string }
  commands: ComposerSlashCommand[]
  composerMode: 'chat' | 'code'
  dismiss: () => void
  draft: string
  draftCommand: ComposerSlashCommand | null
  draftRef: { current: string }
  loading: boolean
  projectId: string
  send: () => void
  sendExtensionCommand: (() => void) | undefined
  sessionPath: string | null
}) {
  if (!input.draft.trim().startsWith('/')) return false
  input.dismiss()
  if (input.draftCommand?.source === 'extension' && input.sendExtensionCommand) {
    input.sendExtensionCommand()
    return true
  }
  if (
    input.draftCommand ||
    !input.sendExtensionCommand ||
    !(input.loading || input.commands.length === 0)
  )
    return false
  resolveSlashCommandAfterLoad(input)
  return true
}

export function getOpenSelectedCommand(input: {
  filteredCommands: ComposerSlashCommand[]
  loading: boolean
  open: boolean
  selectedIndex: number
  draft: string
}) {
  if (!input.open) return undefined
  const selectedCommand = input.filteredCommands[input.selectedIndex]
  if (selectedCommand) return selectedCommand
  return input.loading && shouldWaitForSlashCommands(input.draft) ? null : undefined
}
