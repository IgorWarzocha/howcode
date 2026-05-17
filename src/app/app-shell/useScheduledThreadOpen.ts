import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { DesktopActionResult } from '../desktop/types'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'

type HandleThreadOpenAction = (
  action: 'thread.open',
  payload?: Record<string, unknown>,
) => Promise<DesktopActionResult | null>

export const THREAD_OPEN_ACTION_DELAY_MS = 120
export const THREAD_CYCLE_OPEN_ACTION_DELAY_MS = 450

export type ScheduledThreadOpenInput = {
  projectId: string
  threadId: string
  sessionPath: string
  view?: 'chat' | 'thread' | undefined
  delayMs?: number | undefined
  deferThreadQuery?: boolean | undefined
  commitLocally?: boolean | undefined
}

function shouldCommitScheduledThreadOpen(input: ScheduledThreadOpenInput, state: WorkspaceState) {
  const expectedView = input.view ?? (state.activeView === 'chat' ? 'chat' : 'thread')
  return state.selectedThreadId === input.threadId && state.activeView === expectedView
}

export function useScheduledThreadOpen(input: {
  dispatch: Dispatch<WorkspaceAction>
  handleAction: HandleThreadOpenAction
  setThreadQueryDeferred: Dispatch<SetStateAction<boolean>>
  workspaceState: WorkspaceState
}) {
  const { dispatch, handleAction, setThreadQueryDeferred, workspaceState } = input
  const pendingThreadOpenActionRef = useRef<number | null>(null)
  const workspaceStateRef = useRef(workspaceState)

  useEffect(() => {
    workspaceStateRef.current = workspaceState
  }, [workspaceState])

  useEffect(
    () => () => {
      if (pendingThreadOpenActionRef.current !== null) {
        window.clearTimeout(pendingThreadOpenActionRef.current)
        pendingThreadOpenActionRef.current = null
      }
      setThreadQueryDeferred(false)
    },
    [setThreadQueryDeferred],
  )

  return useCallback(
    (scheduledThreadOpen: ScheduledThreadOpenInput) => {
      if (pendingThreadOpenActionRef.current !== null) {
        window.clearTimeout(pendingThreadOpenActionRef.current)
      }
      setThreadQueryDeferred(scheduledThreadOpen.deferThreadQuery === true)

      pendingThreadOpenActionRef.current = window.setTimeout(() => {
        pendingThreadOpenActionRef.current = null
        setThreadQueryDeferred(false)
        const currentState = workspaceStateRef.current
        if (
          scheduledThreadOpen.commitLocally &&
          !shouldCommitScheduledThreadOpen(scheduledThreadOpen, currentState)
        ) {
          return
        }
        if (scheduledThreadOpen.commitLocally) {
          dispatch({
            type: 'open-thread',
            projectId: scheduledThreadOpen.projectId,
            threadId: scheduledThreadOpen.threadId,
            sessionPath: scheduledThreadOpen.sessionPath,
            view: scheduledThreadOpen.view,
          })
        }
        void handleAction('thread.open', {
          projectId: scheduledThreadOpen.projectId,
          threadId: scheduledThreadOpen.threadId,
          sessionPath: scheduledThreadOpen.sessionPath,
          composerMode: scheduledThreadOpen.view === 'chat' ? 'chat' : 'code',
        })
      }, scheduledThreadOpen.delayMs ?? THREAD_OPEN_ACTION_DELAY_MS)
    },
    [dispatch, handleAction, setThreadQueryDeferred],
  )
}
