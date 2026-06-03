import type { Message } from '../types'

export type ComposerSessionTreeRow = {
  id: string
  depth: number
  label: string
  meta?: string | undefined
  kind: 'user' | 'assistant' | 'tool' | 'summary' | 'system' | 'other'
  isLeaf: boolean
  isOnActivePath: boolean
}

/** Keep true while tuning session-tree popover layout; set false before shipping. */
export const composerSessionTreePanelDevAlwaysOpen = true

function messageKind(message: Message): ComposerSessionTreeRow['kind'] {
  switch (message.role) {
    case 'user':
    case 'assistant':
      return message.role
    case 'toolResult':
      return 'tool'
    case 'branchSummary':
    case 'compactionSummary':
      return 'summary'
    case 'system':
      return 'system'
    default:
      return 'other'
  }
}

function messageLabel(message: Message): string {
  switch (message.role) {
    case 'user':
    case 'assistant':
    case 'system':
    case 'branchSummary':
    case 'compactionSummary':
      return message.content.join(' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    case 'toolResult':
      return message.toolName
    case 'bashExecution':
      return message.command
    case 'custom':
      return message.customType
    default:
      return 'entry'
  }
}

/** Linear active-path rows from the current thread (until desktop exposes full Pi tree). */
export function messagesToSessionTreeRows(
  messages: readonly Message[] | undefined,
): ComposerSessionTreeRow[] {
  if (!messages || messages.length === 0) return []
  return messages.map((message, index) => ({
    id: message.id,
    depth: 0,
    label: messageLabel(message) || '(empty)',
    meta: message.role === 'toolResult' ? 'tool' : undefined,
    kind: messageKind(message),
    isLeaf: index === messages.length - 1,
    isOnActivePath: true,
  }))
}

/** Branched preview for layout review before `thread.session.tree.list` exists. */
export function getSessionTreeDevPreviewRows(): ComposerSessionTreeRow[] {
  return [
    {
      id: 'preview-root',
      depth: 0,
      label: 'Set up worktree sidebar grouping',
      kind: 'user',
      isLeaf: false,
      isOnActivePath: true,
    },
    {
      id: 'preview-a1',
      depth: 1,
      label: 'Mapped project_worktrees and git porcelain parser',
      kind: 'assistant',
      isLeaf: false,
      isOnActivePath: true,
    },
    {
      id: 'preview-branch-summary',
      depth: 1,
      label: 'Branch summary: explored worktree plan, deferred fork UI',
      kind: 'summary',
      meta: 'branch',
      isLeaf: false,
      isOnActivePath: true,
    },
    {
      id: 'preview-u2',
      depth: 1,
      label: 'Add session tree popover in composer',
      kind: 'user',
      isLeaf: false,
      isOnActivePath: true,
    },
    {
      id: 'preview-a2',
      depth: 2,
      label: 'Wiring popover like attachments / slash commands',
      kind: 'assistant',
      isLeaf: false,
      isOnActivePath: true,
    },
    {
      id: 'preview-sibling',
      depth: 2,
      label: 'Alternative: port full Pi TreeSelector (TUI)',
      kind: 'assistant',
      isLeaf: false,
      isOnActivePath: false,
    },
    {
      id: 'preview-tool',
      depth: 2,
      label: 'read',
      meta: 'tool',
      kind: 'tool',
      isLeaf: false,
      isOnActivePath: true,
    },
    {
      id: 'preview-leaf',
      depth: 2,
      label: 'Navigate here with optional summarize (soon)',
      kind: 'user',
      isLeaf: true,
      isOnActivePath: true,
    },
  ]
}

export function getComposerSessionTreeRows(
  messages: readonly Message[] | undefined,
): ComposerSessionTreeRow[] {
  if (composerSessionTreePanelDevAlwaysOpen) return getSessionTreeDevPreviewRows()
  const fromMessages = messagesToSessionTreeRows(messages)
  if (fromMessages.length > 0) return fromMessages
  return getSessionTreeDevPreviewRows()
}
