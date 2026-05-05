import type { AgentSession } from '@mariozechner/pi-coding-agent'
import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import type { AttachmentFileAccess } from './attachment-file-tools.cts'

export type PiRuntime = {
  cwd: string
  session: AgentSession
  chatGroupId?: string | undefined | null | undefined
  attachmentFileAccess?: AttachmentFileAccess | undefined
}

export type RuntimeThreadReason = Extract<DesktopEvent, { type: 'thread-update' }>['reason']
