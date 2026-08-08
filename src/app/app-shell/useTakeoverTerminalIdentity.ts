import { useState } from 'react'
import {
  reconcileTakeoverTerminalIdentity,
  type TakeoverTerminalIdentity,
} from './app-shell-layout-model'
import type { AppShellController } from './useAppShellController'

export function useTakeoverTerminalIdentity(input: {
  activeView: AppShellController['state']['activeView']
  composerProjectId: string
  takeoverPresent: boolean
  takeoverVisible: boolean
  terminalSessionPath: string | null
  threadId: string | null
}) {
  const [identity, setIdentity] = useState<TakeoverTerminalIdentity | null>(null)
  const next: TakeoverTerminalIdentity = {
    key: `${input.composerProjectId}:${input.threadId ?? input.terminalSessionPath ?? 'none'}`,
    projectId: input.composerProjectId,
    threadId: input.threadId,
    sessionPath: input.terminalSessionPath,
  }

  // A local draft is promoted to a persisted session while the same terminal is mounted. Keep its
  // React key through that promotion; adjust before rendering children so real switches remount.
  const nextIdentity = reconcileTakeoverTerminalIdentity({
    activeView: input.activeView,
    current: identity,
    next,
    takeoverPresent: input.takeoverPresent,
    takeoverVisible: input.takeoverVisible,
  })
  if (nextIdentity !== identity) setIdentity(nextIdentity)
  return nextIdentity?.key ?? next.key
}
