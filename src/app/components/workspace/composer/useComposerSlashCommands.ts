import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  appSettingsSlashCommand,
  fallbackAppSlashCommands,
} from '../../../../../shared/composer-slash-commands'
import type { ComposerSlashCommand } from '../../../desktop/types'
import { getComposerSlashCommandsQuery } from '../../../query/desktop-query'

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
const whitespaceCharacterPattern = /\s/
const whitespaceRunPattern = /\s+/

export function getComposerSlashCommandGroupLabel(command: ComposerSlashCommand) {
  return slashCommandSourceLabels[command.source]
}

export const composerSlashCommandListboxId = 'composer-slash-command-listbox'

export function getComposerSlashCommandOptionId(index: number) {
  return `composer-slash-command-${index}`
}

function getSlashCommandFilter(draft: string) {
  if (!draft.startsWith('/')) {
    return null
  }

  const query = draft.slice(1)
  if (whitespaceCharacterPattern.test(query)) {
    return null
  }

  return query.toLowerCase()
}

function shouldWaitForSlashCommands(draft: string) {
  const trimmedDraft = draft.trim()
  return trimmedDraft.startsWith('/') && !trimmedDraft.includes(' ') && trimmedDraft !== '/settings'
}

type UseComposerSlashCommandsOptions = {
  draft: string
  projectId: string
  sessionPath: string | null
  composerMode?: 'chat' | 'code'
  setDraft: (draft: string) => void
  send: () => void
  sendExtensionCommand?: () => void
  onOpenSettingsView: () => void
}

export type ComposerSlashCommands = ReturnType<typeof useComposerSlashCommands>

function resolveSlashCommandAfterLoad(input: {
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

function tryResolveSlashDraft(input: {
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

function getOpenSelectedCommand(input: {
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

function handleOpenSlashCommandKey(input: {
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
  if (input.draft === '/settings') input.submit()
  return true
}

export function useComposerSlashCommands({
  draft,
  projectId,
  sessionPath,
  composerMode = 'code',
  setDraft,
  send,
  sendExtensionCommand,
  onOpenSettingsView,
}: UseComposerSlashCommandsOptions) {
  const [commands, setCommands] = useState<ComposerSlashCommand[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const candidateFilter = getSlashCommandFilter(draft)
  const filter = draft === dismissedDraft ? null : candidateFilter
  const open = filter !== null
  const commandScopeKey = `${projectId}\0${sessionPath ?? ''}\0${composerMode}`
  const draftRef = useRef(draft)
  const commandScopeKeyRef = useRef(commandScopeKey)
  draftRef.current = draft
  commandScopeKeyRef.current = commandScopeKey
  const filteredCommands = useMemo(() => {
    if (filter === null) {
      return []
    }

    return commands
      .filter((command) => command.name.toLowerCase().includes(filter))
      .sort((left, right) => {
        const sourceOrder =
          slashCommandSourceOrder[left.source] - slashCommandSourceOrder[right.source]
        if (sourceOrder !== 0) {
          return sourceOrder
        }

        return left.name.localeCompare(right.name)
      })
  }, [commands, filter])

  const isExactCommandDraft = (command: ComposerSlashCommand) =>
    draft.trim() === `/${command.name}` && !draft.endsWith(' ')

  const getDraftCommand = () => {
    const trimmedDraft = draft.trim()
    if (!trimmedDraft.startsWith('/')) return null
    const commandName = trimmedDraft.slice(1).split(whitespaceRunPattern, 1)[0]
    return commands.find((command) => command.name === commandName) ?? null
  }

  const selectCommand = (command: ComposerSlashCommand) => {
    if (command.source === 'app' && command.name === 'settings') {
      setDraft('')
      onOpenSettingsView()
      return
    }

    if (isExactCommandDraft(command)) {
      dismiss()
      if (command.source === 'extension' && sendExtensionCommand) {
        sendExtensionCommand()
      } else {
        send()
      }
      return
    }

    setDraft(`/${command.name} `)
  }

  const completeCommand = (command: ComposerSlashCommand) => {
    setDraft(`/${command.name} `)
  }

  const submit = () => {
    const openSelectedCommand = getOpenSelectedCommand({
      draft,
      filteredCommands,
      loading,
      open,
      selectedIndex,
    })
    if (openSelectedCommand === null) return
    if (openSelectedCommand) {
      selectCommand(openSelectedCommand)
      return
    }

    // Keep this exact-match only: selected Pi commands named "settings" intentionally insert
    // "/settings " so they can still be sent through AgentSession.prompt().
    if (draft === '/settings') {
      selectCommand(appSettingsSlashCommand)
      return
    }

    if (
      tryResolveSlashDraft({
        commandScopeKey,
        commandScopeKeyRef,
        commands,
        composerMode,
        dismiss,
        draft,
        draftCommand: getDraftCommand(),
        draftRef,
        loading,
        projectId,
        send,
        sendExtensionCommand,
        sessionPath,
      })
    )
      return

    send()
  }

  const dismiss = (options?: { clearDraft?: boolean }) => {
    setDismissedDraft(draft)
    setCommands([])
    setLoading(false)
    setSelectedIndex(0)
    if (options?.clearDraft) {
      setDraft('')
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      dismiss()
      return true
    }
    return handleOpenSlashCommandKey({
      completeCommand,
      draft,
      event,
      filteredCommands,
      loading,
      selectedIndex,
      selectCommand,
      setSelectedIndex,
      submit,
    })
  }

  useEffect(() => {
    if (!open) {
      setSelectedIndex(0)
      setLoading(false)
      return
    }

    let cancelled = false
    setCommands([])
    setSelectedIndex(0)
    setLoading(true)
    void getComposerSlashCommandsQuery({ projectId, sessionPath, composerMode })
      .then((nextCommands) => {
        if (!cancelled) {
          setCommands(nextCommands)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommands(fallbackAppSlashCommands)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [composerMode, open, projectId, sessionPath])

  useEffect(() => {
    void commandScopeKey
    setCommands([])
  }, [commandScopeKey])

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1))
    }
  }, [filteredCommands.length, selectedIndex])

  useEffect(() => {
    if (dismissedDraft !== null && draft !== dismissedDraft) {
      setDismissedDraft(null)
    }
  }, [dismissedDraft, draft])

  return {
    activeDescendantId: open
      ? filteredCommands[selectedIndex]
        ? getComposerSlashCommandOptionId(selectedIndex)
        : undefined
      : undefined,
    commands: filteredCommands,
    handleKeyDown,
    listboxId: composerSlashCommandListboxId,
    loading,
    open,
    dismiss,
    selectCommand,
    selectedIndex,
    setSelectedIndex,
    submit,
  }
}
