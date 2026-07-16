import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import {
  appNewSessionSlashCommand,
  appSettingsSlashCommand,
  fallbackAppSlashCommands,
  sessionTreeSlashCommand,
} from '@howcode/shared/composer-slash-commands'
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import type { ComposerSlashCommand } from '../desktop/types'
import { useLatestRef } from '../hooks/useLatestRef'
import { getComposerSlashCommandsQuery } from '../query/desktop-query'

import { handleOpenSlashCommandKey } from './composer-slash-command-keydown'
import { getOpenSelectedCommand, tryResolveSlashDraft } from './composer-slash-command-resolution'
import {
  composerSlashCommandListboxId,
  filterComposerSlashCommands,
  getComposerSlashCommandOptionId,
  getSlashCommandFilter,
  whitespaceRunPattern,
} from './composer-slash-command-utils'

export {
  getComposerSlashCommandGroupLabel,
  getComposerSlashCommandOptionId,
} from './composer-slash-command-utils'

type UseComposerSlashCommandsOptions = {
  draft: string
  projectId: string
  sessionPath: string | null
  composerMode?: 'chat' | 'code'
  setDraft: (draft: string) => void
  send: () => void
  sendExtensionCommand?: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onStartNewSession?: () => void
  onOpenSessionTree?: () => void
}

export type ComposerSlashCommands = ReturnType<typeof useComposerSlashCommands>

export function useComposerSlashCommands({
  draft,
  projectId,
  sessionPath,
  composerMode = 'code',
  setDraft,
  send,
  sendExtensionCommand,
  onOpenSettingsView,
  onStartNewSession,
  onOpenSessionTree,
}: UseComposerSlashCommandsOptions) {
  const [commands, setCommands] = useState<ComposerSlashCommand[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const candidateFilter = getSlashCommandFilter(draft)
  const filter = draft === dismissedDraft ? null : candidateFilter
  const open = filter !== null
  const commandScopeKey = `${projectId}\0${sessionPath ?? ''}\0${composerMode}`
  const draftRef = useLatestRef(draft)
  const commandScopeKeyRef = useLatestRef(commandScopeKey)
  const filteredCommands = useMemo(
    () => filterComposerSlashCommands(commands, filter),
    [commands, filter],
  )

  const isExactCommandDraft = (command: ComposerSlashCommand) =>
    draft.trim() === `/${command.name}` && !draft.endsWith(' ')

  const getDraftCommand = () => {
    const trimmedDraft = draft.trim()
    if (!trimmedDraft.startsWith('/')) return null
    const commandName = trimmedDraft.slice(1).split(whitespaceRunPattern, 1)[0]
    return commands.find((command) => command.name === commandName) ?? null
  }

  const runAppSlashCommand = (command: ComposerSlashCommand) => {
    if (command.source !== 'app') return false
    if (command.name === 'settings') {
      setDraft('')
      onOpenSettingsView()
      return true
    }
    if (command.name === 'new') {
      setDraft('')
      onStartNewSession?.()
      return true
    }
    if (command.name === 'tree') {
      setDraft('')
      onOpenSessionTree?.()
      return true
    }
    return false
  }

  const selectCommand = (command: ComposerSlashCommand) => {
    if (runAppSlashCommand(command)) return

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

    if (draft === '/new') {
      selectCommand(appNewSessionSlashCommand)
      return
    }

    if (draft === '/tree') {
      selectCommand(sessionTreeSlashCommand)
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
