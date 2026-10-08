import { type RefObject, useLayoutEffect, useRef } from 'react'
import type { ComposerAttachment } from '../desktop/types'
import { useComposerConversationForkPanel } from './useComposerConversationForkPanel'
import { useComposerFileMentions } from './useComposerFileMentions'
import { useComposerAutocompleteEffects } from './useComposerPromptSurfaceEffects'
import { useComposerSkillMentions } from './useComposerSkillMentions'
import { useComposerSlashCommands } from './useComposerSlashCommands'

export function useComposerPromptAutocomplete(input: {
  attachAttachments: (attachments: ComposerAttachment[]) => void
  composerProfile: 'general' | 'coding'
  composerPanelRef: RefObject<HTMLDivElement | null>
  draft: string
  onOpenSettingsView: Parameters<typeof useComposerSlashCommands>[0]['onOpenSettingsView']
  onStartNewSession: () => void
  directoryId: string
  send: () => Promise<void>
  conversationId: string | null
  setDraft: (value: string) => void
  stopButtonBoundaryRef: RefObject<HTMLDivElement | null>
}) {
  const conversationForkPanelRef = useRef<HTMLDivElement>(null)
  const composerPopoverStackRef = useRef<HTMLDivElement>(null)
  const slashCommandPanelRef = useRef<HTMLDivElement>(null)
  const fileMentionPanelRef = useRef<HTMLDivElement>(null)
  const skillMentionPanelRef = useRef<HTMLDivElement>(null)
  const openConversationForkRef = useRef<() => void>(() => undefined)
  const slashCommands = useComposerSlashCommands({
    draft: input.draft,
    directoryId: input.directoryId,
    conversationId: input.conversationId,
    composerProfile: input.composerProfile,
    setDraft: input.setDraft,
    send: input.send,
    onOpenSettingsView: input.onOpenSettingsView,
    onStartNewSession: input.onStartNewSession,
    onOpenConversationFork: () => openConversationForkRef.current(),
  })
  const { dismissConversationFork, openConversationFork, conversationForkOpen } =
    useComposerConversationForkPanel({
      conversationId: input.conversationId,
      slashCommandsOpen: slashCommands.open,
    })
  useLayoutEffect(() => {
    openConversationForkRef.current = openConversationFork
  })
  const skillMentions = useComposerSkillMentions({
    draft: input.draft,
    directoryId: input.directoryId,
    conversationId: input.conversationId,
    composerProfile: input.composerProfile,
    setDraft: input.setDraft,
  })
  const fileMentions = useComposerFileMentions({
    draft: input.draft,
    directoryId: input.directoryId,
    setDraft: input.setDraft,
    attachAttachments: input.attachAttachments,
  })

  useComposerAutocompleteEffects({
    composerPanelRef: input.composerPanelRef,
    fileMentionPanelRef,
    fileMentionListSignature: fileMentions.files
      .map((file) => `${file.kind}:${file.path}`)
      .join('|'),
    fileMentions,
    skillMentionPanelRef,
    skillMentionListSignature: skillMentions.skills
      .map((skill) => `${skill.name}:${skill.filePath}`)
      .join('|'),
    skillMentions,
    slashCommandPanelRef,
    slashCommandListSignature: slashCommands.commands
      .map((command) => `${command.source}:${command.name}`)
      .join('|'),
    slashCommands,
    conversationForkPanelRef,
    stopButtonBoundaryRef: input.stopButtonBoundaryRef,
  })

  return {
    composerPopoverStackRef,
    dismissConversationFork,
    fileMentionPanelRef,
    fileMentions,
    openConversationFork,
    conversationForkOpen,
    conversationForkPanelRef,
    skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef,
    slashCommands,
  }
}
