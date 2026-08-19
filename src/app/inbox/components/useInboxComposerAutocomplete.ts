import { useComposerFileMentions } from '../../composer/useComposerFileMentions'
import { useComposerActiveOptionScroll } from '../../composer/useComposerPromptSurfaceEffects'
import { useComposerSkillMentions } from '../../composer/useComposerSkillMentions'
import { useComposerSlashCommands } from '../../composer/useComposerSlashCommands'
import type { InboxComposerProps } from './inbox-composer-types'
import type { InboxComposerActions } from './useInboxComposerActions'
import type { InboxComposerInput } from './useInboxComposerInput'
import { useInboxComposerMentionDismiss } from './useInboxComposerMentionDismiss'
import type { InboxComposerOverlayState } from './useInboxComposerOverlayState'

export function useInboxComposerAutocomplete(
  props: Pick<InboxComposerProps, 'onOpenSettingsView' | 'onStartNewSession' | 'reply' | 'thread'>,
  input: Pick<InboxComposerInput, 'attachPickerAttachments' | 'setDraftValue'>,
  actions: Pick<InboxComposerActions, 'composerMode' | 'send'>,
  overlay: InboxComposerOverlayState,
) {
  const slashCommands = useComposerSlashCommands({
    draft: props.reply.draft,
    projectId: props.thread.projectId,
    sessionPath: props.thread.sessionPath,
    setDraft: input.setDraftValue,
    send: () => void actions.send(),
    composerMode: actions.composerMode,
    onOpenSettingsView: props.onOpenSettingsView,
    onStartNewSession: props.onStartNewSession,
  })
  const skillMentions = useComposerSkillMentions({
    draft: props.reply.draft,
    projectId: props.thread.projectId,
    sessionPath: props.thread.sessionPath,
    composerMode: actions.composerMode,
    setDraft: input.setDraftValue,
  })
  const fileMentions = useComposerFileMentions({
    draft: props.reply.draft,
    projectId: props.thread.projectId,
    setDraft: input.setDraftValue,
    attachAttachments: input.attachPickerAttachments,
  })

  useInboxComposerMentionDismiss({
    composerSurfaceRef: overlay.composerSurfaceRef,
    fileMentionPanelRef: overlay.fileMentionPanelRef,
    fileMentions,
    setOpenMenu: overlay.setOpenMenu,
    skillMentionPanelRef: overlay.skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef: overlay.slashCommandPanelRef,
    slashCommands,
  })
  useComposerActiveOptionScroll({
    forceTopForFirstOption: true,
    listSignature: slashCommands.commands
      .map((command) => `${command.source}:${command.name}`)
      .join('|'),
    panelRef: overlay.slashCommandPanelRef,
    state: slashCommands,
  })
  useComposerActiveOptionScroll({
    forceTopForFirstOption: false,
    listSignature: fileMentions.files.map((file) => `${file.kind}:${file.path}`).join('|'),
    panelRef: overlay.fileMentionPanelRef,
    state: fileMentions,
  })
  useComposerActiveOptionScroll({
    forceTopForFirstOption: false,
    listSignature: skillMentions.skills.map((skill) => `${skill.name}:${skill.filePath}`).join('|'),
    panelRef: overlay.skillMentionPanelRef,
    state: skillMentions,
  })

  return { fileMentions, skillMentions, slashCommands }
}

export type InboxComposerAutocomplete = ReturnType<typeof useInboxComposerAutocomplete>
