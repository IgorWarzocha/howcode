import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { DesktopActionResult } from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'

type HandleChatOpenAction = (
  action: 'chat.open',
  payload?: Record<string, unknown>,
) => Promise<DesktopActionResult | null>

export const CHAT_OPEN_ACTION_DELAY_MS = 120
export const CHAT_CYCLE_OPEN_ACTION_DELAY_MS = 450

export type ScheduledChatOpenInput = {
  directoryId: string
  chatId: string
  conversationId: string
  branchName?: string | null | undefined
  delayMs?: number | undefined
  deferChatQuery?: boolean | undefined
  commitLocally?: boolean | undefined
}

export function getScheduledChatOpenActionPayload(input: ScheduledChatOpenInput) {
  return {
    directoryId: input.directoryId,
    chatId: input.chatId,
    conversationId: input.conversationId,
    branchName: input.branchName,
  }
}

function shouldCommitScheduledChatOpen(input: ScheduledChatOpenInput, state: WorkspaceState) {
  return state.selectedChatId === input.chatId && state.activeView === 'chat'
}

export function useScheduledChatOpen(input: {
  dispatch: Dispatch<WorkspaceAction>
  handleAction: HandleChatOpenAction
  setChatQueryDeferred: Dispatch<SetStateAction<boolean>>
  workspaceState: WorkspaceState
}) {
  const { dispatch, handleAction, setChatQueryDeferred, workspaceState } = input
  const pendingChatOpenActionRef = useRef<number | null>(null)
  const workspaceStateRef = useRef(workspaceState)

  useEffect(() => {
    workspaceStateRef.current = workspaceState
  }, [workspaceState])

  useEffect(
    () => () => {
      if (pendingChatOpenActionRef.current !== null) {
        window.clearTimeout(pendingChatOpenActionRef.current)
        pendingChatOpenActionRef.current = null
      }
      setChatQueryDeferred(false)
    },
    [setChatQueryDeferred],
  )

  return useCallback(
    (scheduledChatOpen: ScheduledChatOpenInput) => {
      if (pendingChatOpenActionRef.current !== null) {
        window.clearTimeout(pendingChatOpenActionRef.current)
      }
      setChatQueryDeferred(scheduledChatOpen.deferChatQuery === true)

      pendingChatOpenActionRef.current = window.setTimeout(() => {
        pendingChatOpenActionRef.current = null
        setChatQueryDeferred(false)
        const currentState = workspaceStateRef.current
        if (
          scheduledChatOpen.commitLocally &&
          !shouldCommitScheduledChatOpen(scheduledChatOpen, currentState)
        ) {
          return
        }
        if (scheduledChatOpen.commitLocally) {
          dispatch({
            type: 'open-chat',
            directoryId: scheduledChatOpen.directoryId,
            chatId: scheduledChatOpen.chatId,
            conversationId: scheduledChatOpen.conversationId,
          })
        }
        void handleAction('chat.open', getScheduledChatOpenActionPayload(scheduledChatOpen))
      }, scheduledChatOpen.delayMs ?? CHAT_OPEN_ACTION_DELAY_MS)
    },
    [dispatch, handleAction, setChatQueryDeferred],
  )
}
