import { useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../app-shell/keybinding-events'
import { getInboxChatComposerProfile } from '../../common/inbox-chat-scope'
import { withComposerSendLock } from '../../composer/composerSendLock'
import { getDesktopActionErrorMessage } from '../../desktop/action-results'
import { getErrorMessage } from '../../desktop/error-messages'
import type { ComposerModel, ComposerThinkingLevel } from '../../desktop/types'
import type { InboxComposerProps } from './inbox-composer-types'
import type { InboxComposerInput } from './useInboxComposerInput'
import type { InboxComposerOverlayState } from './useInboxComposerOverlayState'

export function useInboxComposerActions(
  props: Pick<InboxComposerProps, 'appSettings' | 'isCompacting' | 'onAction' | 'reply' | 'chat'>,
  input: Pick<
    InboxComposerInput,
    'attachmentsRef' | 'draftValueRef' | 'stopDictationAndFlush' | 'toggleDictation'
  >,
  overlay: Pick<InboxComposerOverlayState, 'setOpenMenu'>,
) {
  const sendLockRef = useRef(false)
  const [localActionPending, setLocalActionPending] = useState(false)
  const composerProfile = getInboxChatComposerProfile(props.chat)
  const inputLocked = props.reply.isSending || localActionPending

  useHowcodeKeybindingCommand('dictation.toggle', (event) => {
    if (!(props.appSettings.showDictationButton && !inputLocked)) return
    event.preventDefault()
    void input.toggleDictation()
  })

  const send = async () => {
    if (props.reply.isSending || props.isCompacting || localActionPending || sendLockRef.current)
      return

    setLocalActionPending(true)
    try {
      await withComposerSendLock(sendLockRef, async () => {
        await input.stopDictationAndFlush()
        await props.reply.send({
          draft: input.draftValueRef.current,
          attachments: input.attachmentsRef.current,
        })
      })
    } finally {
      setLocalActionPending(false)
    }
  }

  const compact = async () => {
    if (
      props.reply.isSending ||
      props.chat.running ||
      props.isCompacting ||
      localActionPending ||
      !props.chat.conversationId ||
      sendLockRef.current
    ) {
      return
    }

    setLocalActionPending(true)
    props.reply.setErrorMessage(null)
    try {
      await withComposerSendLock(sendLockRef, async () => {
        await input.stopDictationAndFlush()
        const result = await props.onAction('composer.send', {
          directoryId: props.chat.directoryId,
          conversationId: props.chat.conversationId,
          text: '/compact',
          attachments: [],
          streamingBehavior: props.appSettings.composerStreamingBehavior,
          composerProfile,
          branchName: props.chat.branchName,
        })
        const actionErrorMessage = getDesktopActionErrorMessage(
          result,
          'Could not compact context.',
        )
        if (actionErrorMessage) props.reply.setErrorMessage(actionErrorMessage)
      })
    } catch (error) {
      props.reply.setErrorMessage(getErrorMessage(error, 'Could not compact context.'))
    } finally {
      setLocalActionPending(false)
    }
  }

  const updateComposerOption = async (
    action: 'composer.model' | 'composer.thinking',
    payload: NonNullable<Parameters<InboxComposerProps['onAction']>[1]>,
  ) => {
    props.reply.setErrorMessage(null)
    try {
      const result = await props.onAction(action, payload)
      const actionErrorMessage = getDesktopActionErrorMessage(
        result,
        'Could not update the composer.',
      )
      if (actionErrorMessage) {
        props.reply.setErrorMessage(actionErrorMessage)
        return
      }
      overlay.setOpenMenu(null)
    } catch (error) {
      props.reply.setErrorMessage(getErrorMessage(error, 'Could not update the composer.'))
    }
  }

  const selectModel = (model: ComposerModel) =>
    updateComposerOption('composer.model', {
      provider: model.provider,
      modelId: model.id,
      directoryId: props.chat.directoryId,
      conversationId: props.chat.conversationId,
      composerProfile,
    })

  const selectThinkingLevel = (level: ComposerThinkingLevel) =>
    updateComposerOption('composer.thinking', {
      level,
      directoryId: props.chat.directoryId,
      conversationId: props.chat.conversationId,
      composerProfile,
    })

  return {
    compact,
    composerProfile,
    inputLocked,
    localActionPending,
    selectModel,
    selectThinkingLevel,
    send,
  }
}

export type InboxComposerActions = ReturnType<typeof useInboxComposerActions>
