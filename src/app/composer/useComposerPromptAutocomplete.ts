import { type RefObject, useLayoutEffect, useRef } from 'react'
import type { ComposerAttachment } from '../desktop/types'
import { useComposerFileMentions } from './useComposerFileMentions'
import { useComposerAutocompleteEffects } from './useComposerPromptSurfaceEffects'
import { useComposerSessionTreePanel } from './useComposerSessionTreePanel'
import { useComposerSkillMentions } from './useComposerSkillMentions'
import { useComposerSlashCommands } from './useComposerSlashCommands'

export function useComposerPromptAutocomplete(input: {
  attachAttachments: (attachments: ComposerAttachment[]) => void
  composerMode: 'chat' | 'code'
  composerPanelRef: RefObject<HTMLDivElement | null>
  draft: string
  onOpenSettingsView: Parameters<typeof useComposerSlashCommands>[0]['onOpenSettingsView']
  onStartNewSession: () => void
  projectId: string
  send: () => Promise<void>
  sendExtensionCommand: NonNullable<
    Parameters<typeof useComposerSlashCommands>[0]['sendExtensionCommand']
  >
  sessionPath: string | null
  setDraft: (value: string) => void
  stopButtonBoundaryRef: RefObject<HTMLDivElement | null>
}) {
  const sessionTreePanelRef = useRef<HTMLDivElement>(null)
  const composerPopoverStackRef = useRef<HTMLDivElement>(null)
  const slashCommandPanelRef = useRef<HTMLDivElement>(null)
  const fileMentionPanelRef = useRef<HTMLDivElement>(null)
  const skillMentionPanelRef = useRef<HTMLDivElement>(null)
  const openSessionTreeRef = useRef<() => void>(() => undefined)
  const slashCommands = useComposerSlashCommands({
    draft: input.draft,
    projectId: input.projectId,
    sessionPath: input.sessionPath,
    composerMode: input.composerMode,
    setDraft: input.setDraft,
    send: input.send,
    sendExtensionCommand: input.sendExtensionCommand,
    onOpenSettingsView: input.onOpenSettingsView,
    onStartNewSession: input.onStartNewSession,
    onOpenSessionTree: () => openSessionTreeRef.current(),
  })
  const { dismissSessionTree, openSessionTree, sessionTreeOpen } = useComposerSessionTreePanel({
    sessionPath: input.sessionPath,
    slashCommandsOpen: slashCommands.open,
  })
  useLayoutEffect(() => {
    openSessionTreeRef.current = openSessionTree
  })
  const skillMentions = useComposerSkillMentions({
    draft: input.draft,
    projectId: input.projectId,
    sessionPath: input.sessionPath,
    composerMode: input.composerMode,
    setDraft: input.setDraft,
  })
  const fileMentions = useComposerFileMentions({
    draft: input.draft,
    projectId: input.projectId,
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
    sessionTreePanelRef,
    stopButtonBoundaryRef: input.stopButtonBoundaryRef,
  })

  return {
    composerPopoverStackRef,
    dismissSessionTree,
    fileMentionPanelRef,
    fileMentions,
    openSessionTree,
    sessionTreeOpen,
    sessionTreePanelRef,
    skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef,
    slashCommands,
  }
}
